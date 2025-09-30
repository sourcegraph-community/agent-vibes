import type { SupabaseServiceClient } from '@/src/ApifyPipeline/Scheduler/Domain/Integrations/Supabase/client';

export interface CronRunInsert {
  id?: string;
  triggerSource: string;
  keywordBatch: string[];
  startedAt: string;
  finishedAt: string;
  status: 'queued' | 'running' | 'succeeded' | 'partial_success' | 'failed';
  processedNewCount: number;
  processedDuplicateCount: number;
  processedErrorCount: number;
  metadata?: Record<string, unknown>;
  errors?: unknown[];
}

export interface CronRunRecord extends CronRunInsert {
  id: string;
}

export const insertCronRun = async (
  client: SupabaseServiceClient,
  payload: CronRunInsert,
): Promise<CronRunRecord> => {
  const { data, error } = await client
    .from('cron_runs')
    .insert({
      id: payload.id,
      trigger_source: payload.triggerSource,
      keyword_batch: payload.keywordBatch,
      started_at: payload.startedAt,
      finished_at: payload.finishedAt,
      status: payload.status,
      processed_new_count: payload.processedNewCount,
      processed_duplicate_count: payload.processedDuplicateCount,
      processed_error_count: payload.processedErrorCount,
      metadata: payload.metadata ?? {},
      errors: payload.errors ?? [],
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Supabase did not return the inserted cron run.');
  }

  return {
    id: data.id as string,
    triggerSource: data.trigger_source as string,
    keywordBatch: data.keyword_batch as string[],
    startedAt: data.started_at as string,
    finishedAt: data.finished_at as string,
    status: data.status as CronRunInsert['status'],
    processedNewCount: data.processed_new_count as number,
    processedDuplicateCount: data.processed_duplicate_count as number,
    processedErrorCount: data.processed_error_count as number,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
    errors: (data.errors ?? []) as unknown[],
  } satisfies CronRunRecord;
};
