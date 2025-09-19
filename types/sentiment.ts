export interface ProcessedTweet {
  id: string;
  text: string;
  fullText: string;
  createdAt: string;
  author: {
    userName: string;
    name: string;
  };
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number;
  url: string;
  sentiment: number;
  tool: string;
  cleanText: string;
  engagementScore: number;
}

export interface SentimentMetrics {
  total: number;
  lastUpdated: string;

  overall: {
    avgSentiment: number;
    positive: number;
    neutral: number;
    negative: number;
  };

  windows: Record<string, {
    count: number;
    avgSentiment: number;
    positive: number;
    negative: number;
  }>;

  byTool: Record<string, {
    count: number;
    avgSentiment: number;
    positive: number;
    negative: number;
    totalEngagement: number;
  }>;

  daily: Record<string, {
    count: number;
    avgSentiment: number;
    positive: number;
    negative: number;
  }>;
}

export interface SentimentApiParams {
  tool?: string;
  window?: '24h' | '7d' | '30d' | 'all';
  limit?: number;
  offset?: number;
}

export interface SentimentTrendPoint {
  date: string;
  avgSentiment: number;
  count: number;
  positive: number;
  negative: number;
}

export interface ToolSentimentComparison {
  tool: string;
  avgSentiment: number;
  count: number;
  positive: number;
  negative: number;
  totalEngagement: number;
  change?: number; // vs previous period
}
