import type { ProcessSentimentsCommand } from './ProcessSentimentsCommand';
import { runSentimentProcessorJob } from '../../../../Background/Jobs/SentimentProcessor';

export interface ProcessSentimentsResponse {
  success: boolean;
  message: string;
  stats?: {
    processed: number;
    failed: number;
    skipped: number;
    totalLatencyMs: number;
    totalTokens: number;
  };
}

export const handleProcessSentiments = async (
  command: ProcessSentimentsCommand,
): Promise<ProcessSentimentsResponse> => {
  const result = await runSentimentProcessorJob({
    batchSize: command.batchSize,
    modelVersion: command.modelVersion,
  });

  if (result.success) {
    return {
      success: true,
      message: `Processed ${result.stats.processed} tweets, ${result.stats.failed} failed`,
      stats: result.stats,
    };
  }

  return {
    success: false,
    message: result.error ?? 'Unknown error occurred',
  };
};
