export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  geminiModel: string;
}

export interface ProcessSentimentsCommandInput {
  batchSize?: number;
  modelVersion?: string;
  maxRetries?: number;
}

export interface ProcessingStats {
  processed: number;
  failed: number;
  skipped: number;
  totalLatencyMs: number;
  totalTokens: number;
}

export interface TweetRecord {
  id: string;
  rawTweetId: string | null;
  runId: string | null;
  platform: string;
  platformId: string;
  revision: number;
  authorHandle: string | null;
  authorName: string | null;
  postedAt: string | null;
  collectedAt: string | null;
  language: string | null;
  content: string;
  url: string | null;
  engagementLikes: number | null;
  engagementRetweets: number | null;
  keywordSnapshot: string[] | null;
  modelContext: Record<string, unknown> | null;
}

export interface SentimentSuccess {
  success: true;
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  summary: string | null;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface SentimentFailure {
  success: false;
  retryable: boolean;
  latencyMs: number;
  code: string;
  message: string;
}

export type SentimentResult = SentimentSuccess | SentimentFailure;
