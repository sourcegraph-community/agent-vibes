import type { SupabaseClient } from '@supabase/supabase-js';

export interface DailySentiment {
  sentimentDay: string
  language: string
  positiveCount: number
  neutralCount: number
  negativeCount: number
  totalCount: number
  avgSentimentScore: number
}

export interface KeywordTrend {
  sentimentDay: string
  keyword: string
  mentionCount: number
  negativeCount: number
  avgSentimentScore: number
}

export interface TweetDetail {
  id: string
  authorHandle: string | null
  authorName: string | null
  postedAt: string
  language: string | null
  content: string
  url: string | null
  engagementLikes: number | null
  engagementRetweets: number | null
  keywords: string[]
  sentimentLabel: string | null
  sentimentScore: number | null
}

export interface DashboardFilters {
  startDate?: string
  endDate?: string
  language?: string
  keyword?: string
  sentiment?: string
  limit?: number
  offset?: number
}

export class DashboardRepository {
  constructor(private supabase: SupabaseClient) {}

  async getDailySentiment(filters: DashboardFilters = {}): Promise<DailySentiment[]> {
    let query = this.supabase
      .from('vw_daily_sentiment')
      .select('*');

    if (filters.startDate) {
      query = query.gte('sentiment_day', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('sentiment_day', filters.endDate);
    }

    if (filters.language) {
      query = query.eq('language', filters.language);
    }

    const { data, error } = await query
      .order('sentiment_day', { ascending: false })
      .limit(filters.limit ?? 30);

    if (error) {
      throw new Error(`Failed to fetch daily sentiment: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      sentimentDay: row.sentiment_day,
      language: row.language,
      positiveCount: row.positive_count,
      neutralCount: row.neutral_count,
      negativeCount: row.negative_count,
      totalCount: row.total_count,
      avgSentimentScore: row.avg_sentiment_score,
    }));
  }

  async getKeywordTrends(filters: DashboardFilters = {}): Promise<KeywordTrend[]> {
    let query = this.supabase
      .from('vw_keyword_trends')
      .select('*');

    if (filters.startDate) {
      query = query.gte('sentiment_day', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('sentiment_day', filters.endDate);
    }

    if (filters.keyword) {
      query = query.eq('keyword', filters.keyword.toLowerCase());
    }

    const { data, error } = await query
      .order('sentiment_day', { ascending: false })
      .order('mention_count', { ascending: false })
      .limit(filters.limit ?? 50);

    if (error) {
      throw new Error(`Failed to fetch keyword trends: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      sentimentDay: row.sentiment_day,
      keyword: row.keyword,
      mentionCount: row.mention_count,
      negativeCount: row.negative_count,
      avgSentimentScore: row.avg_sentiment_score,
    }));
  }

  async getTweetDetails(filters: DashboardFilters = {}): Promise<TweetDetail[]> {
    let query = this.supabase
      .from('normalized_tweets')
      .select(`
        id,
        author_handle,
        author_name,
        posted_at,
        language,
        content,
        url,
        engagement_likes,
        engagement_retweets,
        keyword_snapshot,
        tweet_sentiments (
          sentiment_label,
          sentiment_score
        )
      `);

    if (filters.startDate) {
      query = query.gte('posted_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('posted_at', filters.endDate);
    }

    if (filters.language) {
      query = query.eq('language', filters.language);
    }

    if (filters.keyword) {
      query = query.contains('keyword_snapshot', [filters.keyword]);
    }

    const { data, error } = await query
      .order('posted_at', { ascending: false })
      .limit(filters.limit ?? 20)
      .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 20) - 1);

    if (error) {
      throw new Error(`Failed to fetch tweet details: ${error.message}`);
    }

    return (data ?? []).map(row => {
      const sentiment = Array.isArray(row.tweet_sentiments) && row.tweet_sentiments.length > 0
        ? row.tweet_sentiments[0]
        : null;

      return {
        id: row.id,
        authorHandle: row.author_handle,
        authorName: row.author_name,
        postedAt: row.posted_at,
        language: row.language,
        content: row.content,
        url: row.url,
        engagementLikes: row.engagement_likes,
        engagementRetweets: row.engagement_retweets,
        keywords: row.keyword_snapshot,
        sentimentLabel: sentiment?.sentiment_label ?? null,
        sentimentScore: sentiment?.sentiment_score ?? null,
      };
    }).filter((tweet) => {
      if (filters.sentiment && tweet.sentimentLabel !== filters.sentiment) {
        return false;
      }
      return true;
    });
  }

  async getAvailableKeywords(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('keywords')
      .select('keyword')
      .eq('is_enabled', true)
      .order('keyword');

    if (error) {
      throw new Error(`Failed to fetch keywords: ${error.message}`);
    }

    return (data ?? []).map(row => row.keyword);
  }
}
