import { config } from 'dotenv';
import { runSentimentProcessorJob } from '@/src/ApifyPipeline/Background/Jobs/SentimentProcessor';
import { createSupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';

// Load .env.local for local testing
config({ path: '.env.local' });

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function main() {
  const raw = process.env.NUMBER_OF_PENDING_TWEETS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const batchSize = clamp(Number.isFinite(parsed) ? parsed : 10, 1, 200);

  const rawRetries = process.env.SENTIMENT_MAX_RETRIES ? Number.parseInt(process.env.SENTIMENT_MAX_RETRIES, 10) : NaN;
  const maxRetries = Number.isFinite(rawRetries) ? clamp(rawRetries, 0, 5) : undefined;

  const modelVersion = process.env.SENTIMENT_MODEL_VERSION || undefined;

  const loopAll = (process.env.SENTIMENT_LOOP_ALL ?? 'true').trim().toLowerCase() !== 'false';
  const parsedRuns = Number.parseInt(process.env.SENTIMENT_LOOP_MAX_RUNS ?? '100', 10);
  const maxRuns = Number.isFinite(parsedRuns) ? clamp(parsedRuns, 1, 10000) : 100;

  console.log('🚀 Processing pending sentiments');
  console.log('================================');
  console.log(`Batch Size: ${batchSize}`);
  if (typeof maxRetries === 'number') console.log(`Max Retries: ${maxRetries}`);
  if (modelVersion) console.log(`Model Version: ${modelVersion}`);
  console.log(`Loop All: ${loopAll}`);
  if (loopAll) console.log(`Max Runs: ${maxRuns}`);
  console.log('');

  const supabase = createSupabaseServiceClient();
  const hasPending = async (): Promise<number> => {
    const { count, error } = await supabase
      .from('normalized_tweets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_sentiment');
    if (error) {
      throw new Error(`Failed to count pending sentiments: ${error.message}`);
    }
    return count ?? 0;
  };

  try {
    if (!loopAll) {
      const result = await runSentimentProcessorJob({ batchSize, maxRetries, modelVersion });

      console.log('✅ Completed');
      console.log('--------------------------------');
      console.log(`Success: ${result.success}`);
      console.log(`Processed: ${result.stats.processed}`);
      console.log(`Failed: ${result.stats.failed}`);
      console.log(`Skipped: ${result.stats.skipped}`);
      console.log(`Total Latency (ms): ${result.stats.totalLatencyMs}`);
      console.log(`Total Tokens: ${result.stats.totalTokens}`);

      if (!result.success) {
        console.error(`\n❌ Job reported failure${result.error ? `: ${result.error}` : ''}`);
        process.exit(1);
      }
      return;
    }

    let runs = 0;
    // Loop until no pending sentiments remain or maxRuns reached
    // Guard protects against accidental infinite loops
    while (runs < maxRuns) {
      const pending = await hasPending();
      if (pending <= 0) {
        console.log('✅ No pending sentiments. Exiting.');
        break;
      }

      runs += 1;
      console.log(`\n▶️ Pass ${runs} — Pending: ${pending}`);

      const result = await runSentimentProcessorJob({ batchSize, maxRetries, modelVersion });

      console.log('✅ Completed');
      console.log('--------------------------------');
      console.log(`Success: ${result.success}`);
      console.log(`Processed: ${result.stats.processed}`);
      console.log(`Failed: ${result.stats.failed}`);
      console.log(`Skipped: ${result.stats.skipped}`);
      console.log(`Total Latency (ms): ${result.stats.totalLatencyMs}`);
      console.log(`Total Tokens: ${result.stats.totalTokens}`);

      if (!result.success) {
        console.error(`\n❌ Job reported failure${result.error ? `: ${result.error}` : ''}`);
        process.exit(1);
      }

      // If this pass processed 0 items but pending still exists, avoid tight loop
      // (shouldn't happen in normal flow, but protects against unexpected states)
      if (result.stats.processed === 0) {
        const stillPending = await hasPending();
        if (stillPending > 0) {
          console.warn(`⚠️ No items processed in this pass, but ${stillPending} remain pending. Exiting to avoid looping.`);
          break;
        }
      }
    }

    if (runs >= maxRuns) {
      const remaining = await hasPending();
      if (remaining > 0) {
        console.error(`⚠️ Reached max runs (${maxRuns}) and ${remaining} items still pending. Exiting with non-zero code.`);
        process.exit(1);
      } else {
        console.warn(`⚠️ Reached max runs (${maxRuns}), but no pending items remain.`);
      }
    }
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main();
