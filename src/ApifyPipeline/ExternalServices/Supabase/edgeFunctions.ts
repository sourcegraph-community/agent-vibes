import { getSupabaseEnv } from '@/src/ApifyPipeline/Infrastructure/Config/env';

export interface SentimentFunctionStats {
  processed: number;
  failed: number;
  skipped: number;
  totalLatencyMs: number;
  totalTokens: number;
}

export interface SentimentFunctionResponse {
  success: boolean;
  message: string;
  stats?: SentimentFunctionStats;
}

export interface SentimentFunctionParameters {
  batchSize?: number;
  modelVersion?: string;
  maxRetries?: number;
}

export const invokeSentimentProcessorFunction = async (
  params: SentimentFunctionParameters,
): Promise<SentimentFunctionResponse> => {
  const { supabaseFunctionsUrl, supabaseServiceRoleKey } = getSupabaseEnv();
  const endpoint = `${supabaseFunctionsUrl.replace(/\/$/, '')}/sentiment-processor`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
    body: JSON.stringify({
      batchSize: params.batchSize,
      modelVersion: params.modelVersion,
      maxRetries: params.maxRetries,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Failed to read error response');
    throw new Error(`Edge function responded with ${response.status}: ${text}`);
  }

  const payload = (await response.json()) as SentimentFunctionResponse;
  return payload;
};
