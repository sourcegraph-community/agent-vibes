import type { SupabaseClient } from '@supabase/supabase-js';
import type { RssEntry, RssEntryStatus, RssCategory, RssSummary, RssEntryWithSummary } from '@/src/RssPipeline/Core/Models/RssEntry';

export interface RssEntryInsert {
  feedId: string;
  feedTitle: string | null;
  entryId: string;
  title: string;
  url: string;
  author: string | null;
  publishedAt: string;
  content: string | null;
  summary: string | null;
  category: RssCategory;
  collectedAt: string;
}

export interface RssSummaryInsert {
  entryId: string;
  modelVersion: string;
  summaryText: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  topics: string[];
  processedAt: string;
  latencyMs: number | null;
}

export interface RssSummaryUpdate {
  aiSummary: string;
  summaryStatus: RssEntryStatus;
  summaryAttempts: number;
}

const BATCH_SIZE = 500;
const STUCK_PROCESSING_THRESHOLD_MINUTES = 30;

export class RssRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsertEntry(entry: RssEntryInsert): Promise<RssEntry> {
    const { data, error } = await this.client
      .from('rss_entries')
      .upsert({
        feed_id: entry.feedId,
        feed_title: entry.feedTitle,
        entry_id: entry.entryId,
        title: entry.title,
        url: entry.url,
        author: entry.author,
        published_at: entry.publishedAt,
        content: entry.content,
        summary: entry.summary,
        category: entry.category,
        collected_at: entry.collectedAt,
      }, {
        onConflict: 'entry_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert RSS entry: ${error.message}`);
    }

    return this.mapToRssEntry(data as Record<string, unknown>);
  }

  async insertEntries(entries: RssEntryInsert[]): Promise<RssEntry[]> {
    if (entries.length === 0) {
      return [];
    }

    const results: RssEntry[] = [];

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const payload = batch.map((entry) => ({
        feed_id: entry.feedId,
        feed_title: entry.feedTitle,
        entry_id: entry.entryId,
        title: entry.title,
        url: entry.url,
        author: entry.author,
        published_at: entry.publishedAt,
        content: entry.content,
        summary: entry.summary,
        category: entry.category,
        collected_at: entry.collectedAt,
      }));

      const { data, error } = await this.client
        .from('rss_entries')
        .insert(payload)
        .select();

      if (error) {
        throw error;
      }

      const insertedRows = (data ?? []) as Array<Record<string, unknown>>;

      const batchResults = insertedRows.map((row) => this.mapToRssEntry(row));

      results.push(...batchResults);
    }

    return results;
  }

  async getPendingEntries(limit: number = 100): Promise<RssEntry[]> {
    const { data, error } = await this.client
      .from('rss_entries')
      .select('*')
      .eq('status', 'pending_summary')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => this.mapToRssEntry(row));
  }

  async updateStatus(entryId: string, status: RssEntryStatus): Promise<void> {
    const { error } = await this.client
      .from('rss_entries')
      .update({
        status,
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (error) {
      throw error;
    }
  }

  async updateSummary(entryId: string, update: RssSummaryUpdate): Promise<void> {
    const { error } = await this.client
      .from('rss_entries')
      .update({
        ai_summary: update.aiSummary,
        status: update.summaryStatus,
        summary_attempts: update.summaryAttempts,
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (error) {
      throw new Error(`Failed to update summary: ${error.message}`);
    }
  }

  async markProcessing(entryId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('rss_entries')
      .update({
        status: 'pending_summary',
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('status', 'pending_summary')
      .select('id')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to mark entry as processing: ${error.message}`);
    }

    return !!data;
  }

  async resetStuckEntries(): Promise<number> {
    const thresholdTime = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from('rss_entries')
      .update({
        status: 'pending_summary',
        status_changed_at: new Date().toISOString(),
      })
      .eq('status', 'processing_summary')
      .lt('status_changed_at', thresholdTime)
      .select('id');

    if (error) {
      throw new Error(`Failed to reset stuck entries: ${error.message}`);
    }

    return data?.length ?? 0;
  }

  async claimPendingEntries(batchSize: number, maxAttempts: number = 3): Promise<RssEntry[]> {
    const { data, error } = await this.client.rpc('claim_pending_summaries', {
      p_batch_size: batchSize,
      p_max_attempts: maxAttempts,
    });

    if (error) {
      throw new Error(`Failed to claim pending entries: ${error.message}`);
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => this.mapToRssEntry(row));
  }

  async insertSummary(summary: RssSummaryInsert): Promise<RssSummary> {
    const { data, error } = await this.client
      .from('rss_summaries')
      .insert({
        entry_id: summary.entryId,
        model_version: summary.modelVersion,
        summary_text: summary.summaryText,
        key_points: summary.keyPoints,
        sentiment: summary.sentiment,
        topics: summary.topics,
        processed_at: summary.processedAt,
        latency_ms: summary.latencyMs,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapToRssSummary(data as Record<string, unknown>);
  }

  async getEntriesByCategory(params?: {
    category?: RssCategory;
    limit?: number;
    offset?: number;
  }): Promise<RssEntry[]> {
    let query = this.client
      .from('rss_entries')
      .select('*')
      .order('published_at', { ascending: false });

    if (params?.category) {
      query = query.eq('category', params.category);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit ?? 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get entries by category: ${error.message}`);
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => this.mapToRssEntry(row));
  }

  async countEntriesByCategory(params?: {
    category?: RssCategory;
  }): Promise<number> {
    let query = this.client
      .from('rss_entries')
      .select('*', { count: 'exact', head: true });

    if (params?.category) {
      query = query.eq('category', params.category);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count entries by category: ${error.message}`);
    }

    return count ?? 0;
  }

  async countEntriesSince(params: { startDate: string; category?: RssCategory }): Promise<number> {
    let query = this.client
      .from('rss_entries')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', params.startDate);

    if (params.category) {
      query = query.eq('category', params.category);
    }

    const { count, error } = await query;
    if (error) {
      throw new Error(`Failed to count entries since ${params.startDate}: ${error.message}`);
    }

    return count ?? 0;
  }

  async getEntriesWithSummaries(params?: {
    category?: RssCategory;
    limit?: number;
    offset?: number;
  }): Promise<RssEntryWithSummary[]> {
    let query = this.client
      .from('rss_entries')
      .select(`
        *,
        rss_summaries (*)
      `)
      .order('published_at', { ascending: false });

    if (params?.category) {
      query = query.eq('category', params.category);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit ?? 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const entry = this.mapToRssEntry(row);
      const summaries = row.rss_summaries as Array<Record<string, unknown>> | null;
      const latestSummary = summaries && summaries.length > 0
        ? this.mapToRssSummary(summaries[0])
        : null;

      return {
        ...entry,
        generatedSummary: latestSummary,
      };
    });
  }

  private mapToRssEntry(row: Record<string, unknown>): RssEntry {
    return {
      id: row.id as string,
      feedId: row.feed_id as string,
      feedTitle: (row.feed_title as string | null) ?? null,
      entryId: row.entry_id as string,
      title: row.title as string,
      url: row.url as string,
      author: (row.author as string | null) ?? null,
      publishedAt: row.published_at as string,
      content: (row.content as string | null) ?? null,
      summary: (row.summary as string | null) ?? null,
      category: row.category as RssCategory,
      status: row.status as RssEntryStatus,
      statusChangedAt: row.status_changed_at as string,
      collectedAt: row.collected_at as string,
      createdAt: row.created_at as string,
    };
  }

  private mapToRssSummary(row: Record<string, unknown>): RssSummary {
    return {
      id: row.id as string,
      entryId: row.entry_id as string,
      modelVersion: row.model_version as string,
      summaryText: row.summary_text as string,
      keyPoints: row.key_points as string[],
      sentiment: (row.sentiment as 'positive' | 'neutral' | 'negative' | null) ?? null,
      topics: row.topics as string[],
      processedAt: row.processed_at as string,
      latencyMs: (row.latency_ms as number | null) ?? null,
      createdAt: row.created_at as string,
    };
  }
}
