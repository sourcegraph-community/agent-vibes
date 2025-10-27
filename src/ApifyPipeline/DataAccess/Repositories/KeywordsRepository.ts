import type { SupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';

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

export const fetchEnabledKeywordsByProduct = async (
  client: SupabaseServiceClient,
  product: string,
  limit?: number,
): Promise<string[]> => {
  const normalized = product.trim();
  let query = client
    .from('keywords')
    .select('keyword, is_enabled, priority, last_used_at, product')
    .eq('is_enabled', true)
    .eq('product', normalized)
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

export const fetchDistinctEnabledProducts = async (
  client: SupabaseServiceClient,
): Promise<string[]> => {
  const { data, error } = await client
    .from('keywords')
    .select('product, is_enabled')
    .eq('is_enabled', true);

  if (error) {
    throw error;
  }

  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ product?: string | null }>) {
    const p = (row.product ?? '').trim();
    if (p) set.add(p);
  }

  return Array.from(set).sort();
};
