import { config } from 'dotenv';
import { generateSummariesCommandHandler } from '@/src/RssPipeline/Web/Application/Commands/GenerateSummaries';

config({ path: '.env.local' });

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function main() {
  const raw = process.env.RSS_SUMMARY_BATCH_SIZE;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const batchSize = clamp(Number.isFinite(parsed) ? parsed : 20, 1, 50);

  const maxRetries = process.env.RSS_SUMMARY_MAX_RETRIES
    ? clamp(Number.parseInt(process.env.RSS_SUMMARY_MAX_RETRIES, 10), 0, 5)
    : 3;

  const concurrency = process.env.RSS_SUMMARY_CONCURRENCY
    ? clamp(Number.parseInt(process.env.RSS_SUMMARY_CONCURRENCY, 10), 1, 10)
    : 3;

  console.log('🤖 Generating AI summaries for RSS entries');
  console.log('===========================================');
  console.log(`Batch Size: ${batchSize}`);
  console.log(`Max Retries: ${maxRetries}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log('');

  try {
    const result = await generateSummariesCommandHandler({
      options: {
        batchSize,
        maxRetries,
        resetStuckEntries: true,
      },
    });

    console.log('✅ Completed');
    console.log('------------------------------------');
    console.log(`Success: ${result.success}`);
    console.log(`Generated: ${result.summariesGenerated}`);
    console.log(`Failed: ${result.summariesFailed}`);
    console.log(`Reset: ${result.entriesReset}`);
    console.log(`Queue Depth: ${result.queueDepth}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error: string, idx: number) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
    }

    if (!result.success) {
      console.error(`
❌ Job reported failure: ${result.errors.join(', ')}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main();
