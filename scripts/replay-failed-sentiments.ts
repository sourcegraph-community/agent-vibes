import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv, getGeminiEnv } from '../src/ApifyPipeline/Infrastructure/Config/env';
import { GeminiClient } from '../src/ApifyPipeline/ExternalServices/Gemini/GeminiClient';
import { TweetSentimentsRepository } from '../src/ApifyPipeline/DataAccess/Repositories/TweetSentimentsRepository';
import { SentimentProcessor } from '../src/ApifyPipeline/Core/Services/SentimentProcessor';

interface ReplayOptions {
  minRetryCount?: number;
  limit?: number;
  dryRun?: boolean;
}

async function replayFailedSentiments(options: ReplayOptions = {}) {
  const {
    minRetryCount = 0,
    limit = 50,
    dryRun = false,
  } = options;

  console.log('🔄 Replaying Failed Sentiments');
  console.log('================================');
  console.log(`Min Retry Count: ${minRetryCount}`);
  console.log(`Limit: ${limit}`);
  console.log(`Dry Run: ${dryRun ? 'Yes' : 'No'}`);
  console.log('');

  try {
    const supabaseEnv = getSupabaseEnv();
    const geminiEnv = getGeminiEnv();

    const supabase = createClient(supabaseEnv.supabaseUrl, supabaseEnv.supabaseServiceRoleKey);

    const geminiClient = new GeminiClient({
      apiKey: geminiEnv.apiKey,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const repository = new TweetSentimentsRepository(supabase);

    const processor = new SentimentProcessor(geminiClient, repository, {
      modelVersion: 'gemini-2.0-flash-exp',
      batchSize: limit,
      maxRetries: 2,
    });

    const failedSentiments = await repository.getFailedSentiments(minRetryCount, limit);

    console.log(`Found ${failedSentiments.length} failed sentiments to replay\n`);

    if (failedSentiments.length === 0) {
      console.log('✅ No failed sentiments to replay');
      return;
    }

    if (dryRun) {
      console.log('🔍 Dry Run - Would replay:');
      failedSentiments.forEach((item, index) => {
        console.log(`  ${index + 1}. Tweet ID: ${item.normalizedTweetId} (Retry Count: ${item.retryCount})`);
      });
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const failure of failedSentiments) {
      try {
        console.log(`Processing tweet ${failure.normalizedTweetId}...`);
        const success = await processor.replayFailedSentiment(failure.normalizedTweetId);

        if (success) {
          successCount++;
          console.log(`  ✅ Success`);
        }
        else {
          failureCount++;
          console.log(`  ❌ Failed`);
        }
      }
      catch (error) {
        failureCount++;
        console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n================================');
    console.log('📊 Replay Summary');
    console.log('================================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`📝 Total: ${failedSentiments.length}`);
  }
  catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const options: ReplayOptions = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--min-retry-count':
      options.minRetryCount = Number.parseInt(args[++i], 10);
      break;
    case '--limit':
      options.limit = Number.parseInt(args[++i], 10);
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--help':
      console.log('Usage: npm run replay:sentiments [options]');
      console.log('');
      console.log('Options:');
      console.log('  --min-retry-count <n>  Minimum retry count (default: 0)');
      console.log('  --limit <n>            Maximum number to replay (default: 50)');
      console.log('  --dry-run              Show what would be replayed without executing');
      console.log('  --help                 Show this help message');
      process.exit(0);
  }
}

replayFailedSentiments(options);
