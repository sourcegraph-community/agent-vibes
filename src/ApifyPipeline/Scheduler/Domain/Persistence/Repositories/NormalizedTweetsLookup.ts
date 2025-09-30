import type { SupabaseServiceClient } from '@/src/ApifyPipeline/Scheduler/Domain/Integrations/Supabase/client';

export const fetchExistingNormalizedIds = async (
  client: SupabaseServiceClient,
  platform: string,
  platformIds: string[],
): Promise<Set<string>> => {
  if (platformIds.length === 0) {
    return new Set();
  }

  const { data, error } = await client
    .from('normalized_tweets')
    .select('platform_id')
    .eq('platform', platform)
    .in('platform_id', platformIds);

  if (error) {
    throw error;
  }

  const existing = new Set<string>();

  for (const row of data ?? []) {
    if (typeof row.platform_id === 'string') {
      existing.add(row.platform_id);
    }
  }

  return existing;
};
