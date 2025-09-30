import type { SupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';

export interface RawTweetInsert {
  runId: string;
  platform: string;
  platformId: string;
  collectedAt: string;
  payload: Record<string, unknown>;
  ingestionReason?: string;
}

export interface RawTweetRecord extends RawTweetInsert {
  id: string;
}

export const insertRawTweets = async (
  client: SupabaseServiceClient,
  rows: RawTweetInsert[],
): Promise<RawTweetRecord[]> => {
  if (rows.length === 0) {
    return [];
  }

  const payload = rows.map((row) => ({
    run_id: row.runId,
    platform: row.platform,
    platform_id: row.platformId,
    collected_at: row.collectedAt,
    payload: row.payload,
    ingestion_reason: row.ingestionReason ?? 'initial',
  }));

  const { data, error } = await client
    .from('raw_tweets')
    .insert(payload)
    .select();

  if (error) {
    throw error;
  }

  const insertedRows = (data ?? []) as Array<Record<string, unknown>>;

  return insertedRows.map((row) => ({
    id: row.id as string,
    runId: row.run_id as string,
    platform: row.platform as string,
    platformId: row.platform_id as string,
    collectedAt: row.collected_at as string,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    ingestionReason: row.ingestion_reason as string,
  } satisfies RawTweetRecord));
};
