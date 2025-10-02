import { randomUUID } from 'node:crypto';

import type { SupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';
import { insertCronRun } from '@/src/ApifyPipeline/DataAccess/Repositories/CronRunsRepository';
import { insertRawTweets } from '@/src/ApifyPipeline/DataAccess/Repositories/RawTweetsRepository';
import {
  insertNormalizedTweets,
  type NormalizedTweetInsert,
} from '@/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsRepository';
import { fetchExistingNormalizedIds } from '@/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsLookup';
import {
  normalizeTweet,
  extractPlatformId,
  type ApifyTweetItem,
} from '@/src/ApifyPipeline/Core/Transformations/normalizeTweet';
import { getApifyEnv } from '../../../Infrastructure/Config/env';
import { exit } from 'node:process';

export interface BackfillBatch {
  id: string;
  keywords: string[];
  startDate: string;
  endDate: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface BackfillJobOptions {
  batchSize?: number;
  maxItems?: number;
  pauseMinutes?: number;
  forceNewApifyRun?: boolean;
}

interface CandidateRecord {
  item: ApifyTweetItem;
  keywords: string[];
  collectedAt: string;
}

interface ApifyRunProcessingResult {
  processedNewCount: number;
  processedDuplicateCount: number;
  processedErrorCount: number;
  finishedAt: string;
  datasetId: string;
  itemsCount: number;
  status: 'succeeded' | 'partial_success' | 'failed';
}

const determineStatus = (
  newCount: number,
  errors: unknown[],
): 'succeeded' | 'partial_success' | 'failed' => {
  if (errors.length === 0) {
    return 'succeeded';
  }

  if (newCount > 0) {
    return 'partial_success';
  }

  return 'failed';
};

const cloneMetadata = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return {};
};

const getStringMetadata = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return null;
};

export class BackfillProcessorJob {
  constructor(private supabase: SupabaseServiceClient) {}

  async enqueueBatch(
    batch: Pick<BackfillBatch, 'keywords' | 'startDate' | 'endDate' | 'priority'> & {
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('backfill_batches')
      .insert({
        keywords: batch.keywords,
        start_date: batch.startDate,
        end_date: batch.endDate,
        priority: batch.priority,
        status: 'pending',
        metadata: batch.metadata ?? {},
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
      .maybeSingle();

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
      metadata: cloneMetadata(data.metadata),
    };
  }

  async processBatch(batchId: string, options: BackfillJobOptions = {}): Promise<void> {
    const maxItems = options.maxItems ?? 200;
    const pauseMinutes = options.pauseMinutes ?? 5;
    const forceNewApifyRun = options.forceNewApifyRun ?? false;

    const batch = await this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const env = getApifyEnv();
    const startedAt = new Date().toISOString();
    const actorPath = env.actorId.replace(/\//g, '~');
    const formatDate = (value: string) => new Date(value).toISOString().split('T')[0];
    const formattedStartDate = formatDate(batch.startDate);
    const formattedEndDate = formatDate(batch.endDate);

    const metadata = cloneMetadata(batch.metadata);
    const previousRunId = getStringMetadata(metadata['apifyRunId']);
    const reuseExistingRun = !forceNewApifyRun && !!previousRunId;

    if (!reuseExistingRun && !forceNewApifyRun) {
      throw new Error(
        'Existing Apify run metadata not found for this batch. Set BACKFILL_FORCE_NEW_APIFY_RUN=true to trigger a new Apify run.',
      );
    }

    const previousAttemptCount =
      typeof metadata['attemptCount'] === 'number' ? (metadata['attemptCount'] as number) : 0;

    metadata['attemptCount'] = previousAttemptCount + 1;
    metadata['lastAttemptStartedAt'] = startedAt;
    metadata['lastAttemptStatus'] = 'running';
    metadata['forceNewApifyRun'] = forceNewApifyRun;
    metadata['reusedApifyRun'] = reuseExistingRun;
    metadata['apifyStartDate'] = formattedStartDate;
    metadata['apifyEndDate'] = formattedEndDate;

    await this.updateBatchStatus(batchId, 'running', metadata);

    let apifyRunId: string | null = null;

    try {
      if (reuseExistingRun) {
        apifyRunId = previousRunId;
      }
      else {
        apifyRunId = await this.triggerApifyRun({
          keywords: batch.keywords,
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          maxItems,
          actorPath,
          token: env.token,
        });

        await this.recordBatchExecution(batchId, apifyRunId);
      }

      metadata['apifyRunId'] = apifyRunId;
      metadata['reusedApifyRun'] = reuseExistingRun;

      await this.updateBatchStatus(batchId, 'running', metadata);

      const runResult = await this.processApifyRun({
        apifyRunId: apifyRunId!,
        token: env.token,
        keywords: batch.keywords,
        maxItems,
        startedAt,
        startDate: batch.startDate,
        endDate: batch.endDate,
        apifyStartDate: formattedStartDate,
        apifyEndDate: formattedEndDate,
        backfillBatchId: batchId,
      });

      metadata['apifyDatasetId'] = runResult.datasetId;
      metadata['lastAttemptFinishedAt'] = runResult.finishedAt;
      metadata['lastAttemptStatus'] = runResult.status;
      metadata['lastProcessedNewCount'] = runResult.processedNewCount;
      metadata['lastProcessedDuplicateCount'] = runResult.processedDuplicateCount;
      metadata['lastProcessedErrorCount'] = runResult.processedErrorCount;
      metadata['lastReportedItemCount'] = runResult.itemsCount;
      metadata['completedAt'] = runResult.finishedAt;
      metadata['processedNewCount'] = runResult.processedNewCount;
      metadata['processedDuplicateCount'] = runResult.processedDuplicateCount;
      metadata['processedErrorCount'] = runResult.processedErrorCount;
      metadata['apifyRunStatus'] = runResult.status;

      await this.updateBatchStatus(batchId, 'completed', metadata);

      const nextBatch = await this.getNextBatch();
      if (nextBatch) {
        console.log(`Next batch scheduled to run after ${pauseMinutes} minute pause`);
      }
    }
    catch (err) {
      const error = err as Error;

      metadata['lastAttemptStatus'] = 'failed';
      metadata['lastErrorMessage'] = error.message;
      metadata['lastAttemptFailedAt'] = new Date().toISOString();
      metadata['failedAt'] = metadata['lastAttemptFailedAt'];
      metadata['apifyRunStatus'] = 'failed';

      if (apifyRunId) {
        metadata['apifyRunId'] = apifyRunId;
      }

      await this.updateBatchStatus(batchId, 'failed', metadata);
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
      metadata: cloneMetadata(data.metadata),
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
    const requestBody: Record<string, unknown> = {
      searchTerms: params.keywords,
      maxItems: params.maxItems,
      tweetLanguage: 'en',
      sort: 'Latest',
    };

    if (params.startDate) {
      requestBody.start = params.startDate;
    }

    if (params.endDate) {
      requestBody.end = params.endDate;
    }

    const response = await fetch(`https://api.apify.com/v2/acts/${params.actorPath}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.id;
  }

  private async waitForRunCompletion(params: {
    apifyRunId: string;
    token: string;
    timeoutMs?: number;
  }): Promise<{ datasetId: string; finishedAt: string; itemsCount: number }>
  {
    const timeout = params.timeoutMs ?? 20 * 60 * 1000;
    const waitUrl = new URL(`https://api.apify.com/v2/actor-runs/${params.apifyRunId}`);
    waitUrl.searchParams.set('token', params.token);
    waitUrl.searchParams.set('waitForFinish', String(Math.floor(timeout / 1000)));

    const response = await fetch(waitUrl);
    if (!response.ok) {
      throw new Error(`Failed to wait for Apify run: ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      data?: {
        status?: string;
        defaultDatasetId?: string;
        finishedAt?: string;
        stats?: { totalItems?: number; outputItemCount?: number };
      };
    };

    const data = payload.data;
    if (!data) {
      throw new Error('Apify response missing run data.');
    }

    const status = data.status ?? 'UNKNOWN';
    if (status !== 'SUCCEEDED' && status !== 'SUCCEEDED_WITH_WARNINGS') {
      throw new Error(`Apify run ${params.apifyRunId} finished with status ${status}`);
    }

    const datasetId = data.defaultDatasetId;
    if (!datasetId) {
      throw new Error('Apify run did not provide a dataset ID.');
    }

    const itemsCount =
      data.stats?.totalItems ?? data.stats?.outputItemCount ?? 0;

    return {
      datasetId,
      finishedAt: data.finishedAt ?? new Date().toISOString(),
      itemsCount,
    };
  }

  private async fetchDatasetItems(params: {
    datasetId: string;
    token: string;
    maxItems: number;
  }): Promise<ApifyTweetItem[]> {
    const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${params.datasetId}/items`);
    datasetUrl.searchParams.set('token', params.token);
    datasetUrl.searchParams.set('clean', '1');
    datasetUrl.searchParams.set('format', 'json');
    datasetUrl.searchParams.set('limit', String(params.maxItems));

    const response = await fetch(datasetUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch dataset items: ${response.statusText}`);
    }

    const items = (await response.json()) as unknown;
    if (!Array.isArray(items)) {
      throw new Error('Unexpected dataset response format.');
    }

    return items as ApifyTweetItem[];
  }

  private async processApifyRun(params: {
    apifyRunId: string;
    token: string;
    keywords: string[];
    maxItems: number;
    startedAt: string;
    startDate: string;
    endDate: string;
    apifyStartDate: string;
    apifyEndDate: string;
    backfillBatchId: string;
  }): Promise<ApifyRunProcessingResult> {
    const runInfo = await this.waitForRunCompletion({
      apifyRunId: params.apifyRunId,
      token: params.token,
    });

    const items = await this.fetchDatasetItems({
      datasetId: runInfo.datasetId,
      token: params.token,
      maxItems: params.maxItems,
    });

    const candidateMap = new Map<string, CandidateRecord>();
    const errors: unknown[] = [];
    const ingestionTimestamp = runInfo.finishedAt;

    for (const rawItem of items) {
      const item = rawItem as ApifyTweetItem;
      const collectedAt = (item as { collectedAt?: string }).collectedAt ?? ingestionTimestamp;

      try {
        const platformId = extractPlatformId(item);
        if (candidateMap.has(platformId)) {
          continue;
        }

        candidateMap.set(platformId, {
          item,
          keywords: params.keywords,
          collectedAt,
        });
      } catch (error) {
        errors.push({
          type: 'normalization_precheck_failed',
          message: error instanceof Error ? error.message : String(error),
          item,
        });
      }
    }

    const allPlatformIds = Array.from(candidateMap.keys());
    const existingPlatformIds =
      allPlatformIds.length > 0
        ? await fetchExistingNormalizedIds(this.supabase, 'twitter', allPlatformIds)
        : new Set<string>();

    const newPlatformIds = allPlatformIds.filter(
      (platformId) => !existingPlatformIds.has(platformId),
    );

    const normalizedPrototypes = new Map<string, NormalizedTweetInsert>();
    const internalRunId = randomUUID();

    for (const platformId of newPlatformIds) {
      const candidate = candidateMap.get(platformId);
      if (!candidate) {
        continue;
      }

      try {
        const prototype = normalizeTweet(candidate.item, {
          runId: internalRunId,
          rawTweetId: null,
          collectedAt: candidate.collectedAt,
          keywords: candidate.keywords,
        });

        normalizedPrototypes.set(platformId, prototype);
      } catch (error) {
        errors.push({
          type: 'normalization_failed',
          platformId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const processedNewCount = normalizedPrototypes.size;
    const processedDuplicateCount = existingPlatformIds.size;
    const processedErrorCount = errors.length;

    const finishedAt = runInfo.finishedAt;
    const status = determineStatus(processedNewCount, errors);

    await insertCronRun(this.supabase, {
      id: internalRunId,
      triggerSource: `backfill:${params.backfillBatchId}`,
      keywordBatch: params.keywords,
      startedAt: params.startedAt,
      finishedAt,
      status,
      processedNewCount,
      processedDuplicateCount,
      processedErrorCount,
      metadata: {
        apifyRunId: params.apifyRunId,
        datasetId: runInfo.datasetId,
        maxItemsRequested: params.maxItems,
        backfillBatchId: params.backfillBatchId,
        startDate: params.startDate,
        endDate: params.endDate,
        apifyStartDate: params.apifyStartDate,
        apifyEndDate: params.apifyEndDate,
        totalItemsReported: runInfo.itemsCount,
        candidateCount: candidateMap.size,
      },
      errors,
    });

    const rawRows = Array.from(normalizedPrototypes.keys()).map((platformId) => {
      const candidate = candidateMap.get(platformId);
      if (!candidate) {
        throw new Error(`Missing candidate for platformId ${platformId}`);
      }

      return {
        runId: internalRunId,
        platform: 'twitter' as const,
        platformId,
        collectedAt: candidate.collectedAt,
        payload: {
          item: candidate.item,
          keywords: candidate.keywords,
          fetchedAt: candidate.collectedAt,
        },
        ingestionReason: 'backfill' as const,
      };
    });

    const rawRecords = rawRows.length > 0 ? await insertRawTweets(this.supabase, rawRows) : [];
    const rawIdByPlatform = new Map<string, string | null>();

    for (const record of rawRecords) {
      rawIdByPlatform.set(record.platformId, record.id);
    }

    const normalizedRows: NormalizedTweetInsert[] = Array.from(
      normalizedPrototypes.entries(),
    ).map(([platformId, prototype]) => ({
      ...prototype,
      rawTweetId: rawIdByPlatform.get(platformId) ?? null,
    }));

    if (normalizedRows.length > 0) {
      await insertNormalizedTweets(this.supabase, normalizedRows);
    }

    return {
      processedNewCount,
      processedDuplicateCount,
      processedErrorCount,
      finishedAt,
      datasetId: runInfo.datasetId,
      itemsCount: runInfo.itemsCount,
      status,
    };
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
