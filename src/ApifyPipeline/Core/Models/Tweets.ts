export type NormalizedTweetStatus = 'pending_sentiment' | 'processed' | 'failed';

export interface NormalizedTweet {
  id: string;
  rawTweetId: string | null;
  runId: string | null;
  platform: string;
  platformId: string;
  revision: number;
  authorHandle: string | null;
  authorName: string | null;
  postedAt: string;
  collectedAt: string;
  language: string | null;
  content: string;
  url: string | null;
  engagementLikes: number | null;
  engagementRetweets: number | null;
  keywordSnapshot: string[];
  status: NormalizedTweetStatus;
  statusChangedAt: string;
  modelContext: Record<string, unknown>;
  ingestedAt: string;
  createdAt: string;
}

export interface TweetSentiment {
  id: string;
  normalizedTweetId: string;
  modelVersion: string;
  sentimentLabel: 'positive' | 'neutral' | 'negative';
  sentimentScore: number | null;
  reasoning: Record<string, unknown> | null;
  processedAt: string;
  latencyMs: number | null;
  createdAt: string;
}

export interface KeywordTrendRow {
  sentimentDay: string;
  keyword: string;
  mentionCount: number;
  negativeCount: number;
  avgSentimentScore: number | null;
}

export interface DailySentimentRow {
  sentimentDay: string;
  language: string;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalCount: number;
  avgSentimentScore: number | null;
}
