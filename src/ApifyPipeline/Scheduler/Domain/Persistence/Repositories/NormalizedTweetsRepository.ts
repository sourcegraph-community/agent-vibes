import type { SupabaseServiceClient } from '@/src/ApifyPipeline/Scheduler/Domain/Integrations/Supabase/client';
import type { NormalizedTweetStatus } from '@/src/ApifyPipeline/Scheduler/Domain/Models/Tweets';

export interface NormalizedTweetInsert {
  rawTweetId: string | null;
  runId: string;
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
  statusChangedAt?: string;
  modelContext: Record<string, unknown>;
}

export interface NormalizedTweetRecord extends NormalizedTweetInsert {
  id: string;
}

export const insertNormalizedTweets = async (
  client: SupabaseServiceClient,
  rows: NormalizedTweetInsert[],
): Promise<NormalizedTweetRecord[]> => {
  if (rows.length === 0) {
    return [];
  }

  const payload = rows.map((row) => ({
    raw_tweet_id: row.rawTweetId,
    run_id: row.runId,
    platform: row.platform,
    platform_id: row.platformId,
    revision: row.revision,
    author_handle: row.authorHandle,
    author_name: row.authorName,
    posted_at: row.postedAt,
    collected_at: row.collectedAt,
    language: row.language,
    content: row.content,
    url: row.url,
    engagement_likes: row.engagementLikes,
    engagement_retweets: row.engagementRetweets,
    keyword_snapshot: row.keywordSnapshot,
    status: row.status,
    status_changed_at: row.statusChangedAt ?? row.collectedAt,
    model_context: row.modelContext,
  }));

  const { data, error } = await client
    .from('normalized_tweets')
    .insert(payload)
    .select();

  if (error) {
    throw error;
  }

  const insertedRows = (data ?? []) as Array<Record<string, unknown>>;

  return insertedRows.map((row) => ({
    id: row.id as string,
    rawTweetId: row.raw_tweet_id as string | null,
    runId: row.run_id as string,
    platform: row.platform as string,
    platformId: row.platform_id as string,
    revision: row.revision as number,
    authorHandle: row.author_handle as string | null,
    authorName: row.author_name as string | null,
    postedAt: row.posted_at as string,
    collectedAt: row.collected_at as string,
    language: row.language as string | null,
    content: row.content as string,
    url: row.url as string | null,
    engagementLikes: row.engagement_likes as number | null,
    engagementRetweets: row.engagement_retweets as number | null,
    keywordSnapshot: (row.keyword_snapshot ?? []) as string[],
    status: row.status as NormalizedTweetStatus,
    statusChangedAt: row.status_changed_at as string,
    modelContext: (row.model_context ?? {}) as Record<string, unknown>,
  } satisfies NormalizedTweetRecord));
};
