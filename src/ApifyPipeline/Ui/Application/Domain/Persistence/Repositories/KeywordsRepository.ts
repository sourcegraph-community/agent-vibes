import type { SupabaseServiceClient } from '@/src/ApifyPipeline/Ui/Application/Domain/Integrations/Supabase/client';

export interface KeywordRow {
  keyword: string;
  is_enabled: boolean;
  priority: number;
  last_used_at: string | null;
}

export const fetchEnabledKeywords = async (
  client: SupabaseServiceClient,
  limit?: number,
): Promise<string[]> => {
  let query = client
    .from('keywords')
    .select('keyword, is_enabled, priority, last_used_at')
    .eq('is_enabled', true)
    .order('priority', { ascending: true })
    .order('keyword', { ascending: true });

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ keyword: string }>;

  return rows.map((row) => row.keyword);
};
