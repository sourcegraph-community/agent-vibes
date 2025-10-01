import { createClient } from '@supabase/supabase-js';
import { BackfillProcessorJob } from '../src/ApifyPipeline/Background/Jobs/BackfillProcessor/BackfillProcessorJob';

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const job = new BackfillProcessorJob(supabase);

  const keywords = ['ampcode.com', '"ampcode"', '"sourcegraph amp"', '(to:ampcode)'];

  // Configuration: Customize for testing
  const totalDays = parseInt(process.env.BACKFILL_DAYS || '30', 10);
  const batchDays = parseInt(process.env.BACKFILL_BATCH_SIZE || '5', 10);
  const numBatches = Math.ceil(totalDays / batchDays);

  const endDate = new Date();

  console.log(`Configuration:`);
  console.log(`  Total days: ${totalDays}`);
  console.log(`  Days per batch: ${batchDays}`);
  console.log(`  Number of batches: ${numBatches}\n`);

  const batches = [];
  for (let i = 0; i < numBatches; i++) {
    const batchEnd = new Date(endDate);
    batchEnd.setDate(batchEnd.getDate() - i * batchDays);

    const batchStart = new Date(batchEnd);
    batchStart.setDate(batchStart.getDate() - batchDays);

    batches.push({
      keywords,
      startDate: batchStart.toISOString(),
      endDate: batchEnd.toISOString(),
      priority: 100 - i * 10,
    });
  }

  console.log(`Enqueuing ${batches.length} backfill batches (${totalDays} days total)...`);

  for (const batch of batches) {
    const batchId = await job.enqueueBatch(batch);
    console.log(
      `✓ Enqueued batch ${batchId}: ${batch.startDate.split('T')[0]} to ${batch.endDate.split('T')[0]} (priority ${batch.priority})`,
    );
  }

  console.log('\nBackfill batches enqueued successfully!');
  console.log('Run `npm run process:backfill` to process the next batch.');
}

main().catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
