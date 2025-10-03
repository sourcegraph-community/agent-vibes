import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv, getGeminiEnv } from '../../../Infrastructure/Config/env';
import { GeminiClient } from '../../../ExternalServices/Gemini/GeminiClient';
import { TweetSentimentsRepository } from '../../../DataAccess/Repositories/TweetSentimentsRepository';
import { SentimentProcessor } from '../../../Core/Services/SentimentProcessor';

export interface SentimentProcessorJobConfig {
  batchSize?: number;
  modelVersion?: string;
  maxRetries?: number;
}

export interface SentimentProcessorJobResult {
  success: boolean;
  stats: {
    processed: number;
    failed: number;
    skipped: number;
    totalLatencyMs: number;
    totalTokens: number;
  };
  error?: string;
}

export const runSentimentProcessorJob = async (
  config: SentimentProcessorJobConfig = {},
): Promise<SentimentProcessorJobResult> => {
  try {
    const supabaseEnv = getSupabaseEnv();
    const geminiEnv = getGeminiEnv();

    const supabase = createClient(supabaseEnv.supabaseUrl, supabaseEnv.supabaseServiceRoleKey);

    const geminiClient = new GeminiClient({
      apiKey: geminiEnv.apiKey,
      maxRetries: config.maxRetries,
      timeoutMs: 30000,
    });

    const repository = new TweetSentimentsRepository(supabase);

    // Concurrency & rate limits (env-driven)
    const envInt = (v: string | undefined) => (v ? Number.parseInt(v, 10) : NaN);
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    const envConcurrency = envInt(process.env.SENTIMENT_CONCURRENCY);
    const envRpmCap = envInt(process.env.SENTIMENT_RPM_CAP);
    const envTpmCap = envInt(process.env.SENTIMENT_TPM_CAP);
    const envTokensEst = envInt(process.env.SENTIMENT_TOKENS_PER_REQUEST_ESTIMATE);

    const processor = new SentimentProcessor(geminiClient, repository, {
      modelVersion: config.modelVersion ?? 'gemini-2.5-flash',
      batchSize: config.batchSize ?? 10,
      maxRetries: config.maxRetries ?? 2,
      // Default to sequential + 15 RPM behavior unless env overrides
      rateLimitDelayMs: 4000,
      concurrency: Number.isFinite(envConcurrency) ? clamp(envConcurrency, 1, 1000) : 1,
      rpmCap: Number.isFinite(envRpmCap) ? clamp(envRpmCap, 1, 100000) : 15,
      tpmCap: Number.isFinite(envTpmCap) ? clamp(envTpmCap, 1, 100000000) : undefined,
      tokensPerRequestEstimate: Number.isFinite(envTokensEst) ? clamp(envTokensEst, 1, 100000) : 600,
    });

    const stats = await processor.processPendingTweets();

    return {
      success: true,
      stats,
    };
  }
  catch (error) {
    return {
      success: false,
      stats: {
        processed: 0,
        failed: 0,
        skipped: 0,
        totalLatencyMs: 0,
        totalTokens: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};
