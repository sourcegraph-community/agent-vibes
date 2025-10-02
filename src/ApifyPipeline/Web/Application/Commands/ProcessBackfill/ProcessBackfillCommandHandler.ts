import type { BackfillProcessorJob } from '@/src/ApifyPipeline/Background/Jobs/BackfillProcessor/BackfillProcessorJob';
import type { ProcessBackfillCommand, ProcessBackfillCommandResult } from './ProcessBackfillCommand';
import { exit } from 'process';

export interface ProcessBackfillDependencies {
  createJob: () => BackfillProcessorJob;
}

export const processBackfillCommandHandler = async (
  command: ProcessBackfillCommand,
  dependencies: ProcessBackfillDependencies,
): Promise<ProcessBackfillCommandResult> => {
  try {
    const job = dependencies.createJob();
    const nextBatch = await job.getNextBatch();

    if (!nextBatch) {
      return {
        success: true,
        message: 'No pending backfill batches',
      } satisfies ProcessBackfillCommandResult;
    }

    await job.processBatch(nextBatch.id, {
      forceNewApifyRun: command.forceNewApifyRun ?? false,
    });

    return {
      success: true,
      message: `Processed backfill batch ${nextBatch.id}`,
      batchId: nextBatch.id,
    } satisfies ProcessBackfillCommandResult;
  }
  catch (error) {
    return {
      success: false,
      message: 'Failed to process backfill batch',
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies ProcessBackfillCommandResult;
  }
};
