import { randomUUID } from 'node:crypto';

import { Actor, log } from 'apify';
import { z } from 'zod';

import { createSupabaseServiceClient } from '@/src/ApifyPipeline/Scheduler/Domain/Integrations/Supabase/client';
import { runTwitterScraper } from '@/src/ApifyPipeline/Scheduler/Domain/Integrations/Apify/twitterScraper';
import { fetchEnabledKeywords } from '@/src/ApifyPipeline/Scheduler/Domain/Persistence/Repositories/KeywordsRepository';
import { insertCronRun } from '@/src/ApifyPipeline/Scheduler/Domain/Persistence/Repositories/CronRunsRepository';
import { insertRawTweets } from '@/src/ApifyPipeline/Scheduler/Domain/Persistence/Repositories/RawTweetsRepository';
import {
  insertNormalizedTweets,
  type NormalizedTweetInsert,
} from '@/src/ApifyPipeline/Scheduler/Domain/Persistence/Repositories/NormalizedTweetsRepository';
import { fetchExistingNormalizedIds } from '@/src/ApifyPipeline/Scheduler/Domain/Persistence/Repositories/NormalizedTweetsLookup';
import {
  normalizeTweet,
  extractPlatformId,
  type ApifyTweetItem,
} from '@/src/ApifyPipeline/Scheduler/Domain/Transformations/normalizeTweet';
import { chunkArray } from '@/src/ApifyPipeline/Scheduler/Domain/Utilities/chunk';

const ingestionSchema = z
  .object({
    tweetLanguage: z.string().trim().min(2).max(5).optional(),
    sort: z.enum(['Top', 'Latest']).default('Top'),
    maxItemsPerKeyword: z.number().int().min(1).max(500).default(200),
    keywordBatchSize: z.number().int().min(1).max(5).default(5),
    cooldownSeconds: z.number().int().min(0).max(900).default(0),
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
    sort: 'Top',
    maxItemsPerKeyword: 200,
    keywordBatchSize: 5,
    cooldownSeconds: 0,
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
  const rawInput = ((await Actor.getInput()) ?? {}) as Record<string, unknown>;
  const input = inputSchema.parse(rawInput) satisfies ActorInput;

  const supabase = createSupabaseServiceClient();
  const keywords = await resolveKeywords(supabase, input);

  if (keywords.length === 0) {
    log.warning('No keywords available for ingestion.');
    return;
  }

  const startedAt = new Date().toISOString();
  const ingestionConfig = input.ingestion;
  const keywordBatches = chunkArray(keywords, ingestionConfig.keywordBatchSize);

  const candidateMap = new Map<string, CandidateRecord>();
  const errors: unknown[] = [];

  for (const batch of keywordBatches) {
    try {
      const items = await runTwitterScraper(
        {
          keywords: batch,
          tweetLanguage: ingestionConfig.tweetLanguage,
          sort: ingestionConfig.sort,
          maxItemsPerKeyword: ingestionConfig.maxItemsPerKeyword,
          minimumEngagement: ingestionConfig.minimumEngagement,
        },
        undefined,
      );

      for (const item of items) {
        try {
          const platformId = extractPlatformId(item);

          if (candidateMap.has(platformId)) {
            continue;
          }

          candidateMap.set(platformId, {
            item,
            keywords: batch,
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
    } catch (error) {
      errors.push({
        type: 'scraper_batch_failed',
        keywords: batch,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (ingestionConfig.cooldownSeconds > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, ingestionConfig.cooldownSeconds * 1000),
      );
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
    if (!candidate) {
      continue;
    }

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
      batchesAttempted: keywordBatches.length,
      requestedMaxItems: ingestionConfig.maxItemsPerKeyword,
      sort: ingestionConfig.sort,
      tweetLanguage: ingestionConfig.tweetLanguage,
      requestedAt: startedAt,
      inputMetadata: input.metadata ?? {},
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
      runId,
      platform: 'twitter',
      platformId,
      collectedAt: candidate.collectedAt,
      payload: {
        item: candidate.item,
        keywords: candidate.keywords,
        fetchedAt: candidate.collectedAt,
      },
      ingestionReason: 'initial',
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
  }

  log.info('Apify ingestion run completed.', {
    runId,
    newRecords: processedNewCount,
    duplicateRecords: processedDuplicateCount,
    errorCount: processedErrorCount,
  });
});
