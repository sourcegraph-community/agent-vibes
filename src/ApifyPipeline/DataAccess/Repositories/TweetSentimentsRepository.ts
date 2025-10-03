import type { SupabaseClient } from '@supabase/supabase-js';
import type { TweetSentiment } from '../../Core/Models/Tweets';

export interface InsertSentimentData {
  normalizedTweetId: string;
  modelVersion: string;
  sentimentLabel: 'positive' | 'neutral' | 'negative';
  sentimentScore: number | null;
  reasoning: Record<string, unknown> | null;
  latencyMs: number | null;
}

export interface SentimentFailureData {
  normalizedTweetId: string;
  modelVersion: string | null;
  failureStage: string;
  errorCode: string | null;
  errorMessage: string;
  retryCount: number;
  payload: Record<string, unknown> | null;
}

export class TweetSentimentsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async insertSentiment(data: InsertSentimentData): Promise<TweetSentiment | null> {
    const { data: result, error } = await this.client
      .from('tweet_sentiments')
      .insert({
        normalized_tweet_id: data.normalizedTweetId,
        model_version: data.modelVersion,
        sentiment_label: data.sentimentLabel,
        sentiment_score: data.sentimentScore,
        reasoning: data.reasoning,
        latency_ms: data.latencyMs,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert sentiment: ${error.message}`);
    }

    if (!result) {
      return null;
    }

    return this.mapToTweetSentiment(result);
  }

  async recordFailure(data: SentimentFailureData): Promise<void> {
    const { error } = await this.client
      .from('sentiment_failures')
      .insert({
        normalized_tweet_id: data.normalizedTweetId,
        model_version: data.modelVersion,
        failure_stage: data.failureStage,
        error_code: data.errorCode,
        error_message: data.errorMessage,
        retry_count: data.retryCount,
        payload: data.payload,
      });

    if (error) {
      throw new Error(`Failed to record sentiment failure: ${error.message}`);
    }
  }

  async getPendingSentiments(limit: number): Promise<Array<{ id: string; content: string; authorHandle: string | null; language: string | null }>> {
    const { data, error } = await this.client
      .from('normalized_tweets')
      .select('id, content, author_handle, language')
      .eq('status', 'pending_sentiment')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch pending sentiments: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      id: row.id,
      content: row.content,
      authorHandle: row.author_handle,
      language: row.language,
    }));
  }

  async updateTweetStatus(tweetId: string, status: 'processed' | 'failed'): Promise<void> {
    const { error } = await this.client
      .from('normalized_tweets')
      .update({
        status,
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', tweetId);

    if (error) {
      throw new Error(`Failed to update tweet status: ${error.message}`);
    }
  }

  async getFailedSentiments(minRetryCount: number, limit: number): Promise<Array<{ normalizedTweetId: string; retryCount: number }>> {
    const { data, error } = await this.client
      .from('sentiment_failures')
      .select('normalized_tweet_id, retry_count')
      .gte('retry_count', minRetryCount)
      .order('last_attempt_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch failed sentiments: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      normalizedTweetId: row.normalized_tweet_id,
      retryCount: row.retry_count,
    }));
  }

  async getRetryCountForTweet(tweetId: string): Promise<number> {
    const { data, error } = await this.client
      .from('sentiment_failures')
      .select('retry_count')
      .eq('normalized_tweet_id', tweetId)
      .order('last_attempt_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return 0;
    }

    return data.retry_count ?? 0;
  }

  async getTweetById(tweetId: string): Promise<{ id: string; content: string; authorHandle: string | null; language: string | null } | null> {
    const { data, error } = await this.client
      .from('normalized_tweets')
      .select('id, content, author_handle, language')
      .eq('id', tweetId)
      .eq('status', 'pending_sentiment')
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      content: data.content,
      authorHandle: data.author_handle,
      language: data.language,
    };
  }

  private mapToTweetSentiment(row: Record<string, unknown>): TweetSentiment {
    return {
      id: String(row.id),
      normalizedTweetId: String(row.normalized_tweet_id),
      modelVersion: String(row.model_version),
      sentimentLabel: row.sentiment_label as 'positive' | 'neutral' | 'negative',
      sentimentScore: row.sentiment_score as number | null,
      reasoning: row.reasoning as Record<string, unknown> | null,
      processedAt: String(row.processed_at),
      latencyMs: row.latency_ms as number | null,
      createdAt: String(row.created_at),
    };
  }
}
