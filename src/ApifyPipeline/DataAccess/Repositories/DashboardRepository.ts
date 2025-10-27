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

export interface ProductDailySentiment {
  sentimentDay: string
  language: string
  product: string
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
  products?: string[]
  limit?: number
  offset?: number
}

const keywordVariants = (raw: string): string[] => {
  const base = raw.trim().toLowerCase();
  const stripped = base.length >= 2 && base.startsWith('"') && base.endsWith('"')
    ? base.slice(1, -1).trim()
    : base;
  const quoted = `"${stripped}"`;
  return Array.from(new Set([base, stripped, quoted]));
};

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

  async getProductDailySentiment(filters: DashboardFilters = {}): Promise<ProductDailySentiment[]> {
    let query = this.supabase
      .from('vw_product_daily_sentiment')
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

    if (filters.products && filters.products.length > 0) {
      query = query.in('product', filters.products);
    }

    const { data, error } = await query
      .order('sentiment_day', { ascending: false })
      .limit(filters.limit ?? 30);

    if (error) {
      throw new Error(`Failed to fetch product daily sentiment: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      sentimentDay: row.sentiment_day,
      language: row.language,
      product: row.product,
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
      const variants = keywordVariants(filters.keyword);
      query = query.in('keyword', variants);
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
    const sentimentJoin = filters.sentiment ? '!inner' : '';
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
        tweet_sentiments${sentimentJoin} (
          sentiment_label,
          sentiment_score,
          processed_at
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
      const raw = (filters.keyword ?? '').trim();
      if (raw) {
        const arrLiteral = `{${JSON.stringify(raw)}}`;
        query = query.filter('keyword_snapshot', 'cs', arrLiteral);
      }
    }

    if (filters.sentiment) {
      query = query.eq('tweet_sentiments.sentiment_label', filters.sentiment);
    }

    // Keep only the latest sentiment per tweet
    query = query
      .order('processed_at', { foreignTable: 'tweet_sentiments', ascending: false })
      .limit(1, { foreignTable: 'tweet_sentiments' });

    const { data, error } = await query
      .order('posted_at', { ascending: false })
      .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 20) - 1);

    if (error) {
      throw new Error(`Failed to fetch tweet details: ${error as Error}`);
    }

    const rows = (data ?? []) as Array<{
      id: string;
      author_handle: string | null;
      author_name: string | null;
      posted_at: string;
      language: string | null;
      content: string;
      url: string | null;
      engagement_likes: number | null;
      engagement_retweets: number | null;
      keyword_snapshot: string[];
      tweet_sentiments: Array<{
        sentiment_label: string;
        sentiment_score: number;
        processed_at?: string;
      }>;
    }>;
    return rows.map((row) => {
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
