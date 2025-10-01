import type { ProcessSentimentsCommand } from './ProcessSentimentsCommand';
import { runSentimentProcessorJob } from '../../../../Background/Jobs/SentimentProcessor';
import { invokeSentimentProcessorFunction } from '../../../../ExternalServices/Supabase/edgeFunctions';

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
  source?: 'supabase_edge' | 'fallback_job';
}

export const handleProcessSentiments = async (
  command: ProcessSentimentsCommand,
): Promise<ProcessSentimentsResponse> => {
  const fallbackEnabled = process.env.SENTIMENT_EDGE_FALLBACK === 'true';

  try {
    const edgeResponse = await invokeSentimentProcessorFunction({
      batchSize: command.batchSize,
      modelVersion: command.modelVersion,
      maxRetries: command.maxRetries,
    });

    if (edgeResponse.success) {
      return {
        success: true,
        message: edgeResponse.message,
        stats: edgeResponse.stats,
        source: 'supabase_edge',
      } satisfies ProcessSentimentsResponse;
    }

    if (!fallbackEnabled) {
      return {
        success: false,
        message: edgeResponse.message,
        stats: edgeResponse.stats,
        source: 'supabase_edge',
      } satisfies ProcessSentimentsResponse;
    }

    const fallback = await runSentimentProcessorJob({
      batchSize: command.batchSize,
      modelVersion: command.modelVersion,
      maxRetries: command.maxRetries,
    });

    if (fallback.success) {
      return {
        success: true,
        message: `Fallback job succeeded after edge failure: ${fallback.stats.processed} processed, ${fallback.stats.failed} failed`,
        stats: fallback.stats,
        source: 'fallback_job',
      } satisfies ProcessSentimentsResponse;
    }

    return {
      success: false,
      message: `Edge function failed (${edgeResponse.message}) and fallback job also failed (${fallback.error ?? 'Unknown error'})`,
      stats: fallback.stats,
      source: 'fallback_job',
    } satisfies ProcessSentimentsResponse;
  }
  catch (error) {
    if (fallbackEnabled) {
      const fallback = await runSentimentProcessorJob({
        batchSize: command.batchSize,
        modelVersion: command.modelVersion,
        maxRetries: command.maxRetries,
      });

      if (fallback.success) {
        return {
          success: true,
          message: `Fallback job succeeded after edge exception: ${fallback.stats.processed} processed, ${fallback.stats.failed} failed`,
          stats: fallback.stats,
          source: 'fallback_job',
        } satisfies ProcessSentimentsResponse;
      }

      return {
        success: false,
        message: `Edge function request errored (${error instanceof Error ? error.message : String(error)}) and fallback failed (${fallback.error ?? 'Unknown error'})`,
        stats: fallback.stats,
        source: 'fallback_job',
      } satisfies ProcessSentimentsResponse;
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Edge function invocation failed',
      source: 'supabase_edge',
    } satisfies ProcessSentimentsResponse;
  }
};
