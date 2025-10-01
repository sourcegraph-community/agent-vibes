import type { SupabaseClient } from '@supabase/supabase-js';
import { getApifyEnv } from '../../../Infrastructure/Config/env';

export interface BackfillBatch {
  id: string;
  keywords: string[];
  startDate: string;
  endDate: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  createdAt: Date;
}

export interface BackfillJobOptions {
  batchSize?: number;
  maxItems?: number;
  pauseMinutes?: number;
}

export class BackfillProcessorJob {
  constructor(private supabase: SupabaseClient) {}

  async enqueueBatch(batch: Omit<BackfillBatch, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const { data, error } = await this.supabase
      .from('backfill_batches')
      .insert({
        keywords: batch.keywords,
        start_date: batch.startDate,
        end_date: batch.endDate,
        priority: batch.priority,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to enqueue backfill batch: ${error.message}`);
    }

    return data.id;
  }

  async getNextBatch(): Promise<BackfillBatch | null> {
    const { data, error } = await this.supabase
      .from('backfill_batches')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get next batch: ${error.message}`);
    }

    return {
      id: data.id,
      keywords: data.keywords,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      priority: data.priority,
      createdAt: new Date(data.created_at),
    };
  }

  async processBatch(batchId: string, options: BackfillJobOptions = {}): Promise<void> {
    const batchSize = options.batchSize ?? 5;
    const maxItems = options.maxItems ?? 200;
    const pauseMinutes = options.pauseMinutes ?? 5;

    await this.updateBatchStatus(batchId, 'running');

    try {
      const batch = await this.getBatchById(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }

      const env = getApifyEnv();
      const runId = await this.triggerApifyRun({
        keywords: batch.keywords,
        startDate: batch.startDate,
        endDate: batch.endDate,
        maxItems,
        actorPath: env.actorId.replace(/\//g, '~'),
        token: env.token,
      });

      await this.recordBatchExecution(batchId, runId);

      await this.updateBatchStatus(batchId, 'completed', {
        completedAt: new Date().toISOString(),
        apifyRunId: runId,
      });

      const nextBatch = await this.getNextBatch();
      if (nextBatch) {
        console.log(`Next batch scheduled to run after ${pauseMinutes} minute pause`);
      }
    }
    catch (err) {
      const error = err as Error;
      await this.updateBatchStatus(batchId, 'failed', {
        errorMessage: error.message,
        failedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  private async getBatchById(batchId: string): Promise<BackfillBatch | null> {
    const { data, error } = await this.supabase
      .from('backfill_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error) {
      return null;
    }

    return {
      id: data.id,
      keywords: data.keywords,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      priority: data.priority,
      createdAt: new Date(data.created_at),
    };
  }

  private async updateBatchStatus(
    batchId: string,
    status: BackfillBatch['status'],
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.supabase
      .from('backfill_batches')
      .update({
        status,
        metadata: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    if (error) {
      throw new Error(`Failed to update batch status: ${error.message}`);
    }
  }

  private async triggerApifyRun(params: {
    keywords: string[];
    startDate: string;
    endDate: string;
    maxItems: number;
    actorPath: string;
    token: string;
  }): Promise<string> {
    const response = await fetch(`https://api.apify.com/v2/acts/${params.actorPath}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify({
        input: {
          searchTerms: params.keywords,
          start: params.startDate,
          end: params.endDate,
          maxItems: params.maxItems,
          tweetLanguage: 'en',
          sort: 'Latest',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.id;
  }

  private async recordBatchExecution(batchId: string, apifyRunId: string): Promise<void> {
    const { error } = await this.supabase.from('cron_runs').insert({
      trigger_source: `backfill:${batchId}`,
      keyword_batch: [],
      status: 'running',
      metadata: {
        backfillBatchId: batchId,
        apifyRunId,
      },
    });

    if (error) {
      console.error('Failed to record batch execution:', error);
    }
  }
}
