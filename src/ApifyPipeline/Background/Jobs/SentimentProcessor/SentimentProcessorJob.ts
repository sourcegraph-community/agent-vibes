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
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const repository = new TweetSentimentsRepository(supabase);

    const processor = new SentimentProcessor(geminiClient, repository, {
      modelVersion: config.modelVersion ?? 'gemini-2.0-flash-exp',
      batchSize: config.batchSize ?? 10,
      maxRetries: config.maxRetries ?? 2,
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
