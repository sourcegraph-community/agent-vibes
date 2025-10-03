import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv, getGeminiEnv } from '../src/ApifyPipeline/Infrastructure/Config/env';
import { GeminiClient } from '../src/ApifyPipeline/ExternalServices/Gemini/GeminiClient';
import { TweetSentimentsRepository } from '../src/ApifyPipeline/DataAccess/Repositories/TweetSentimentsRepository';
import { SentimentProcessor } from '../src/ApifyPipeline/Core/Services/SentimentProcessor';

// Load .env.local
config({ path: '.env.local' });

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface ReplayOptions {
  minRetryCount?: number;
  limit?: number;
  dryRun?: boolean;
}

async function replayFailedSentiments(options: ReplayOptions = {}) {
  const rawBatch = process.env.NUMBER_OF_PENDING_TWEETS;
  const parsedBatch = rawBatch ? Number.parseInt(rawBatch, 10) : NaN;
  const defaultLimit = clamp(Number.isFinite(parsedBatch) ? parsedBatch : 10, 1, 25);

  const {
    minRetryCount = 0,
    limit = defaultLimit,
    dryRun = false,
  } = options;

  const effectiveLimit = clamp(limit, 1, 25);

  const envMaxRetries = process.env.SENTIMENT_MAX_RETRIES
    ? clamp(Number.parseInt(process.env.SENTIMENT_MAX_RETRIES, 10), 0, 5)
    : 2;

  const modelVersion = process.env.SENTIMENT_MODEL_VERSION || 'gemini-2.5-flash-lite';

  console.log('🔄 Replaying Failed Sentiments');
  console.log('================================');
  console.log(`Min Retry Count: ${minRetryCount}`);
  console.log(`Limit: ${effectiveLimit}`);
  console.log(`Model Version: ${modelVersion}`);
  console.log(`Max Retries: ${envMaxRetries}`);
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
      modelVersion,
      batchSize: effectiveLimit,
      maxRetries: envMaxRetries,
    });

    const failedSentiments = await repository.getFailedSentiments(minRetryCount, effectiveLimit);

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
      console.log('  --limit <n>            Maximum number to replay (default: NUMBER_OF_PENDING_TWEETS or 10)');
      console.log('  --dry-run              Show what would be replayed without executing');
      console.log('  --help                 Show this help message');
      process.exit(0);
  }
}

// If no limit provided via CLI, fall back to env default (NUMBER_OF_PENDING_TWEETS clamped 1..25)
if (options.limit == null || Number.isNaN(options.limit)) {
  const rawBatch = process.env.NUMBER_OF_PENDING_TWEETS;
  const parsedBatch = rawBatch ? Number.parseInt(rawBatch, 10) : NaN;
  options.limit = clamp(Number.isFinite(parsedBatch) ? parsedBatch : 10, 1, 25);
} else {
  options.limit = clamp(options.limit, 1, 25);
}

replayFailedSentiments(options);
