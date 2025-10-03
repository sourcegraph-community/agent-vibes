import { config } from 'dotenv';
import { runSentimentProcessorJob } from '@/src/ApifyPipeline/Background/Jobs/SentimentProcessor';

// Load .env.local for local testing
config({ path: '.env.local' });

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function main() {
  const raw = process.env.NUMBER_OF_PENDING_TWEETS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const batchSize = clamp(Number.isFinite(parsed) ? parsed : 10, 1, 200);

  const maxRetries = process.env.SENTIMENT_MAX_RETRIES
    ? clamp(Number.parseInt(process.env.SENTIMENT_MAX_RETRIES, 10), 0, 5)
    : undefined;

  const modelVersion = process.env.SENTIMENT_MODEL_VERSION || undefined;

  console.log('🚀 Processing pending sentiments');
  console.log('================================');
  console.log(`Batch Size: ${batchSize}`);
  if (typeof maxRetries === 'number') console.log(`Max Retries: ${maxRetries}`);
  if (modelVersion) console.log(`Model Version: ${modelVersion}`);
  console.log('');

  try {
    const result = await runSentimentProcessorJob({
      batchSize,
      maxRetries,
      modelVersion,
    });

    console.log('✅ Completed');
    console.log('--------------------------------');
    console.log(`Success: ${result.success}`);
    console.log(`Processed: ${result.stats.processed}`);
    console.log(`Failed: ${result.stats.failed}`);
    console.log(`Skipped: ${result.stats.skipped}`);
    console.log(`Total Latency (ms): ${result.stats.totalLatencyMs}`);
    console.log(`Total Tokens: ${result.stats.totalTokens}`);

    if (!result.success) {
      console.error(`
❌ Job reported failure${result.error ? `: ${result.error}` : ''}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main();
