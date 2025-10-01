import { config } from 'dotenv';
import { createSupabaseServiceClient } from '../src/ApifyPipeline/ExternalServices/Supabase/client';
import { BackfillProcessorJob } from '../src/ApifyPipeline/Background/Jobs/BackfillProcessor/BackfillProcessorJob';
import { processBackfillCommandHandler } from '../src/ApifyPipeline/Web/Application/Commands/ProcessBackfill/ProcessBackfillCommandHandler';
import type { ProcessBackfillCommand } from '../src/ApifyPipeline/Web/Application/Commands/ProcessBackfill/ProcessBackfillCommand';

config({ path: '.env.local' });

async function main() {
  const supabase = createSupabaseServiceClient();

  const forceNewApifyRun = process.env.BACKFILL_FORCE_NEW_APIFY_RUN === 'true';
  const command: ProcessBackfillCommand = forceNewApifyRun
    ? { forceNewApifyRun: true }
    : {};

  const result = await processBackfillCommandHandler(command, {
    createJob: () => new BackfillProcessorJob(supabase),
  });

  if (!result.success) {
    throw new Error(result.message + (result.error ? `: ${result.error}` : ''));
  }

  if (result.batchId) {
    console.log(`Processed backfill batch ${result.batchId}`);
  }
  else {
    console.log(result.message);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Backfill processing failed:', message);
  process.exit(1);
});
