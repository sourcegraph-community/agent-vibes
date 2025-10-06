import { randomUUID } from 'node:crypto';

import { Actor, log } from 'apify';
import { z } from 'zod';

import { createSupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';
import { runTwitterScraper } from '@/src/ApifyPipeline/ExternalServices/Apify/twitterScraper';
import { fetchEnabledKeywords } from '@/src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository';
import { insertCronRun } from '@/src/ApifyPipeline/DataAccess/Repositories/CronRunsRepository';
import { insertRawTweets } from '@/src/ApifyPipeline/DataAccess/Repositories/RawTweetsRepository';
import {
  insertNormalizedTweets,
  getLastCollectedDate,
  type NormalizedTweetInsert,
} from '@/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsRepository';
import { fetchExistingNormalizedIds } from '@/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsLookup';
import {
  normalizeTweet,
  extractPlatformId,
  type ApifyTweetItem,
} from '@/src/ApifyPipeline/Core/Transformations/normalizeTweet';
import { invokeSentimentProcessorFunction } from '@/src/ApifyPipeline/ExternalServices/Supabase/edgeFunctions';

const ingestionSchema = z
  .object({
    tweetLanguage: z.string().trim().min(2).max(5).optional(),
    sort: z.enum(['Top', 'Latest']).default('Latest'),
    // Total max items across all keywords
    maxItems: z.number().int().min(1).max(1000).default(100),
    cooldownSeconds: z.number().int().min(0).max(900).default(0),
    // Disabled by default to align with one-shot collection behavior
    useDateFiltering: z.boolean().default(false),
    defaultLookbackDays: z.number().int().min(1).max(30).default(7),
    minimumEngagement: z
      .object({
        retweets: z.number().int().min(0).optional(),
        favorites: z.number().int().min(0).optional(),
        replies: z.number().int().min(0).optional(),
      })
      .partial()
      .optional()
      .default({}),
  })
  .default({
    sort: 'Latest',
    maxItems: 100,
    cooldownSeconds: 0,
    useDateFiltering: false,
    defaultLookbackDays: 7,
    minimumEngagement: {},
  });

const inputSchema = z.object({
  triggerSource: z.string().default('manual'),
  keywords: z.array(z.string().min(1)).optional(),
  ingestion: ingestionSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type ActorInput = z.infer<typeof inputSchema>;

interface CandidateRecord {
  item: ApifyTweetItem;
  keywords: string[];
  collectedAt: string;
}

const resolveKeywords = async (
  client: ReturnType<typeof createSupabaseServiceClient>,
  input: ActorInput,
): Promise<string[]> => {
  if (input.keywords && input.keywords.length > 0) {
    return input.keywords;
  }

  return await fetchEnabledKeywords(client);
};

const determineStatus = (newCount: number, errors: unknown[]):
  | 'succeeded'
  | 'partial_success'
  | 'failed' => {
  if (errors.length === 0) {
    return 'succeeded';
  }

  if (newCount > 0) {
    return 'partial_success';
  }

  return 'failed';
};

Actor.main(async () => {
  const startedAt = new Date().toISOString();
  let supabase: ReturnType<typeof createSupabaseServiceClient> | null = null;
  let input: ActorInput | null = null;

  try {
    const rawInput = ((await Actor.getInput()) ?? {}) as Record<string, unknown>;
    input = inputSchema.parse(rawInput) satisfies ActorInput;

    supabase = createSupabaseServiceClient();
    const keywords = await resolveKeywords(supabase, input);

    if (keywords.length === 0) {
      log.warning('No keywords available for ingestion.');
      return;
    }

    const ingestionConfig = input.ingestion;

    // Calculate sinceDate only when enabled
    let sinceDate: string | null = null;
    if (ingestionConfig.useDateFiltering) {
      const lastCollectedAt = await getLastCollectedDate(supabase);

      if (lastCollectedAt) {
        sinceDate = new Date(lastCollectedAt).toISOString().split('T')[0];
      } else {
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - ingestionConfig.defaultLookbackDays);
        sinceDate = lookbackDate.toISOString().split('T')[0];
      }

      log.info('Using date filter for collection', {
        lastCollectedAt,
        sinceDate,
        keywords,
      });
    }

    const candidateMap = new Map<string, CandidateRecord>();
    const errors: unknown[] = [];

    // Single call across all keywords with total cap
    const items = await runTwitterScraper({
      keywords,
      tweetLanguage: ingestionConfig.tweetLanguage,
      sort: ingestionConfig.sort,
      maxItems: ingestionConfig.maxItems,
      sinceDate,
      minimumEngagement: ingestionConfig.minimumEngagement,
    });

    for (const item of items) {
      try {
        const platformId = extractPlatformId(item);
        if (candidateMap.has(platformId)) {
          continue;
        }
        candidateMap.set(platformId, {
          item,
          keywords,
          collectedAt: new Date().toISOString(),
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
    const existingPlatformIds = await fetchExistingNormalizedIds(
      supabase,
      'twitter',
      allPlatformIds,
    );

    const newPlatformIds = allPlatformIds.filter(
      (platformId) => !existingPlatformIds.has(platformId),
    );

    const runId = randomUUID();
    const normalizedPrototypes = new Map<string, NormalizedTweetInsert>();

    for (const platformId of newPlatformIds) {
      const candidate = candidateMap.get(platformId);
      if (!candidate) continue;

      try {
        const prototype = normalizeTweet(candidate.item, {
          runId,
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
    const status = determineStatus(processedNewCount, errors);

    const rawRows = Array.from(normalizedPrototypes.keys()).map((platformId) => {
      const candidate = candidateMap.get(platformId);
      if (!candidate) {
        throw new Error(`Missing candidate for platformId ${platformId}`);
      }

      return {
        runId,
        platform: 'twitter' as const,
        platformId,
        collectedAt: candidate.collectedAt,
        payload: {
          item: candidate.item,
          keywords: candidate.keywords,
          fetchedAt: candidate.collectedAt,
        },
        ingestionReason: 'initial' as const,
      };
    });

    const rawRecords = await insertRawTweets(supabase, rawRows);
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
      await insertNormalizedTweets(supabase, normalizedRows);
      // Immediately trigger sentiment processing for up to the number inserted
      try {
        await invokeSentimentProcessorFunction({ batchSize: normalizedRows.length });
      } catch (e) {
        log.warning('Sentiment processor function invocation failed', { error: String(e) });
      }
    }

    // Insert cron run AFTER successful data persistence
    const finishedAt = new Date().toISOString();

    await insertCronRun(supabase, {
      id: runId,
      triggerSource: input.triggerSource,
      keywordBatch: keywords,
      startedAt,
      finishedAt,
      status,
      processedNewCount,
      processedDuplicateCount,
      processedErrorCount,
      metadata: {
        batchesAttempted: 1,
        requestedMaxItems: ingestionConfig.maxItems,
        sort: ingestionConfig.sort,
        tweetLanguage: ingestionConfig.tweetLanguage,
        useDateFiltering: ingestionConfig.useDateFiltering,
        defaultLookbackDays: ingestionConfig.defaultLookbackDays,
        requestedAt: startedAt,
        inputMetadata: input.metadata ?? {},
        candidateCount: candidateMap.size,
      },
      errors,
    });

    log.info('Apify ingestion run completed.', {
      runId,
      newRecords: processedNewCount,
      duplicateRecords: processedDuplicateCount,
      errorCount: processedErrorCount,
    });
  } catch (error) {
    log.error('Fatal error in TweetCollectorJob', { error });

    if (supabase) {
      try {
        await insertCronRun(supabase, {
          id: randomUUID(),
          triggerSource: input?.triggerSource ?? 'unknown',
          keywordBatch: [],
          startedAt,
          finishedAt: new Date().toISOString(),
          status: 'failed',
          processedNewCount: 0,
          processedDuplicateCount: 0,
          processedErrorCount: 1,
          metadata: { fatalError: true },
          errors: [
            {
              type: 'actor_crash',
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        });
      } catch (logError) {
        log.error('Failed to log fatal error to cron_runs', { logError });
      }
    }

    throw error;
  }
});
