export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SentimentRequest {
  tweetId: string;
  content: string;
  authorHandle?: string | null;
  language?: string | null;
}

export interface SentimentResponse {
  label: SentimentLabel;
  score: number;
  summary?: string;
  confidence?: number;
}

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface GeminiApiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface SentimentProcessingResult {
  success: boolean;
  sentiment?: SentimentResponse;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
}
