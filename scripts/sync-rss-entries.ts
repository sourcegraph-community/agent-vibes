import { config } from 'dotenv';
import { syncEntriesCommandHandler } from '@/src/RssPipeline/Web/Application/Commands/SyncEntries';

config({ path: '.env.local' });

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function main() {
  const raw = process.env.RSS_SYNC_LIMIT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const limit = clamp(Number.isFinite(parsed) ? parsed : 100, 1, 500);

  const sinceDays = process.env.RSS_SYNC_SINCE_DAYS
    ? clamp(Number.parseInt(process.env.RSS_SYNC_SINCE_DAYS, 10), 1, 90)
    : 7;

  console.log('🔄 Syncing RSS entries from Miniflux');
  console.log('====================================');
  console.log(`Limit: ${limit}`);
  console.log(`Since Days: ${sinceDays}`);
  console.log('');

  try {
    const result = await syncEntriesCommandHandler({
      options: {
        limit,
        publishedAfter: new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    console.log('✅ Completed');
    console.log('------------------------------------');
    console.log(`Success: ${result.success}`);
    console.log(`Synced: ${result.entriesSynced}`);
    console.log(`Skipped: ${result.entriesSkipped}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Error details (first 5):');
      result.errors.slice(0, 5).forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
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
