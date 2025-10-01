import type { SupabaseClient } from 'npm:@supabase/supabase-js';
import type { TweetRecord } from '../types.ts';

export interface InsertSentimentParams {
  tweetId: string;
  modelVersion: string;
  label: 'positive' | 'neutral' | 'negative';
  score: number;
  summary: string | null;
  latencyMs: number;
}

export interface RecordFailureParams {
  tweetId: string;
  modelVersion: string;
  failureStage: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  payload: Record<string, unknown> | null;
}

export class SupabaseTweetRepository {
  constructor(private readonly client: SupabaseClient) {}

  async fetchPendingTweets(limit: number): Promise<TweetRecord[]> {
    const { data, error } = await this.client
      .from('normalized_tweets')
      .select(
        `id, raw_tweet_id, run_id, platform, platform_id, revision, author_handle, author_name, posted_at, collected_at, language, content, url, engagement_likes, engagement_retweets, keyword_snapshot, model_context`,
      )
      .eq('status', 'pending_sentiment')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch pending tweets: ${error.message}`);
    }

    return (data ?? []).map(row => this.mapTweetRow(row));
  }

  async insertSentiment(params: InsertSentimentParams): Promise<void> {
    const { error } = await this.client.from('tweet_sentiments').insert({
      normalized_tweet_id: params.tweetId,
      model_version: params.modelVersion,
      sentiment_label: params.label,
      sentiment_score: params.score,
      reasoning: params.summary ? { summary: params.summary } : null,
      latency_ms: params.latencyMs,
    });

    if (error) {
      throw new Error(`Failed to insert sentiment: ${error.message}`);
    }
  }

  async recordFailure(params: RecordFailureParams): Promise<void> {
    const { error } = await this.client.from('sentiment_failures').insert({
      normalized_tweet_id: params.tweetId,
      model_version: params.modelVersion,
      failure_stage: params.failureStage,
      error_code: params.errorCode,
      error_message: params.errorMessage,
      retry_count: params.retryCount,
      payload: params.payload,
    });

    if (error) {
      throw new Error(`Failed to record sentiment failure: ${error.message}`);
    }
  }

  async updateTweetStatus(tweet: TweetRecord, status: 'processed' | 'failed'): Promise<void> {
    const { error } = await this.client.from('normalized_tweets').insert({
      raw_tweet_id: tweet.rawTweetId,
      run_id: tweet.runId,
      platform: tweet.platform,
      platform_id: tweet.platformId,
      revision: tweet.revision + 1,
      author_handle: tweet.authorHandle,
      author_name: tweet.authorName,
      posted_at: tweet.postedAt,
      collected_at: tweet.collectedAt,
      language: tweet.language,
      content: tweet.content,
      url: tweet.url,
      engagement_likes: tweet.engagementLikes,
      engagement_retweets: tweet.engagementRetweets,
      keyword_snapshot: tweet.keywordSnapshot,
      status,
      status_changed_at: new Date().toISOString(),
      model_context: tweet.modelContext,
    });

    if (error) {
      throw new Error(`Failed to insert tweet revision: ${error.message}`);
    }
  }

  async getRetryCount(tweetId: string): Promise<number> {
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

  private mapTweetRow(row: Record<string, unknown>): TweetRecord {
    return {
      id: String(row.id),
      rawTweetId: (row.raw_tweet_id ?? null) as string | null,
      runId: (row.run_id ?? null) as string | null,
      platform: String(row.platform),
      platformId: String(row.platform_id),
      revision: Number(row.revision ?? 0),
      authorHandle: (row.author_handle ?? null) as string | null,
      authorName: (row.author_name ?? null) as string | null,
      postedAt: (row.posted_at ?? null) as string | null,
      collectedAt: (row.collected_at ?? null) as string | null,
      language: (row.language ?? null) as string | null,
      content: String(row.content ?? ''),
      url: (row.url ?? null) as string | null,
      engagementLikes: (row.engagement_likes ?? null) as number | null,
      engagementRetweets: (row.engagement_retweets ?? null) as number | null,
      keywordSnapshot: (row.keyword_snapshot ?? null) as string[] | null,
      modelContext: (row.model_context ?? null) as Record<string, unknown> | null,
    };
  }
}
