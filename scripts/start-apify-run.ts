import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { startApifyRunCommandHandler } from '@/src/ApifyPipeline/Web/Application/Commands/StartApifyRun';
import { getApifyEnv } from '@/src/ApifyPipeline/Infrastructure/Config/env';
import { createSupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';
import { fetchEnabledKeywords, fetchEnabledKeywordsByProduct, fetchDistinctEnabledProducts } from '@/src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository';
import { insertCronRun } from '@/src/ApifyPipeline/DataAccess/Repositories/CronRunsRepository';
import { insertRawTweets } from '@/src/ApifyPipeline/DataAccess/Repositories/RawTweetsRepository';
import { insertNormalizedTweets, type NormalizedTweetInsert } from '@/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsRepository';
import { fetchExistingNormalizedIds } from '@/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsLookup';
import { normalizeTweet, extractPlatformId, type ApifyTweetItem } from '@/src/ApifyPipeline/Core/Transformations/normalizeTweet';


// Load .env.local for local testing
config({ path: '.env.local' });

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function bool(val: string | undefined, def = false): boolean {
  if (val == null) return def;
  const v = val.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

async function resolveKeywords(): Promise<string[]> {
  const override = process.env.COLLECTOR_KEYWORDS;
  if (override && override.trim().length > 0) {
    return override.split(',').map(s => s.trim()).filter(Boolean);
  }

  try {
    const supabase = createSupabaseServiceClient();
    const product = (process.env.COLLECTOR_PRODUCT || '').trim();
    if (product) {
      let kws = await fetchEnabledKeywordsByProduct(supabase, product);
      if (kws.length === 0) {
        // Fallback to all enabled keywords from DB when product has no rows
        kws = await fetchEnabledKeywords(supabase);
      }
      if (kws.length > 0) return kws;
    } else {
      const kws = await fetchEnabledKeywords(supabase);
      if (kws.length > 0) return kws;
    }
  } catch (err) {
    console.error('❗ Keyword resolution failed while querying DB; not using static defaults due to error:', toErrorMessage(err));
    throw err;
  }

  return [
    'ampcode.com',
    'ampcode',
    '"sourcegraph amp"',
    '(to:ampcode)',
    'windsurf',
    '(to:windsurf)',
    'windsurf.com',
    'augmentcode',
    'augmentcode.com',
    '(to:augmentcode)',
    'cline',
    'cline.bot',
    '(to:cline)',
    'kilocode',
    'kilocode.ai',
    '(to:kilocode)',
    'opencode',
    'opencode.ai',
    '(to:opencode)',
  ];
}

async function waitForRunCompletion(apifyRunId: string, token: string): Promise<{ datasetId: string; finishedAt: string; itemsCount: number }>
{
  const waitUrl = new URL(`https://api.apify.com/v2/actor-runs/${apifyRunId}`);
  waitUrl.searchParams.set('token', token);
  waitUrl.searchParams.set('waitForFinish', String(Math.floor((20 * 60 * 1000) / 1000)));

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
    throw new Error(`Apify run ${apifyRunId} finished with status ${status}`);
  }

  const datasetId = data.defaultDatasetId;
  if (!datasetId) {
    throw new Error('Apify run did not provide a dataset ID.');
  }

  const itemsCount = data.stats?.totalItems ?? data.stats?.outputItemCount ?? 0;

  return {
    datasetId,
    finishedAt: data.finishedAt ?? new Date().toISOString(),
    itemsCount,
  };
}

async function fetchDatasetItems(datasetId: string, token: string, maxItems: number): Promise<ApifyTweetItem[]>
{
  const datasetUrl = new URL(`https://api.apify.com/v2/datasets/${datasetId}/items`);
  datasetUrl.searchParams.set('token', token);
  datasetUrl.searchParams.set('clean', '1');
  datasetUrl.searchParams.set('format', 'json');
  datasetUrl.searchParams.set('limit', String(maxItems));

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

async function findLastApifyRunId(triggerSource: string): Promise<{ runId: string; startedAt: string } | null> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('cron_runs')
      .select('metadata, started_at, status')
      .eq('trigger_source', triggerSource)
      .in('status', ['failed', 'running', 'partial_success'])
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) return null;

    for (const row of (data ?? []) as Array<{ metadata?: Record<string, unknown>; started_at?: string; status?: string }>) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const runId = typeof meta['apifyRunId'] === 'string' ? (meta['apifyRunId'] as string) : null;
      if (runId) {
        return { runId, startedAt: row.started_at ?? new Date().toISOString() };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function recordRunStart(params: { id: string; triggerSource: string; keywords: string[]; apifyRunId: string; startedAt: string }): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from('cron_runs').insert({
      id: params.id,
      trigger_source: params.triggerSource,
      keyword_batch: params.keywords,
      started_at: params.startedAt,
      status: 'running',
      processed_new_count: 0,
      processed_duplicate_count: 0,
      processed_error_count: 0,
      metadata: { apifyRunId: params.apifyRunId },
    });
  } catch {
    // best effort
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

async function recordFailureRun(params: { triggerSource: string; keywords: string[]; startedAt: string; apifyRunId?: string; error: unknown }): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    const message = toErrorMessage(params.error);
    await insertCronRun(supabase, {
      id: randomUUID(),
      triggerSource: params.triggerSource,
      keywordBatch: params.keywords,
      startedAt: params.startedAt,
      finishedAt: new Date().toISOString(),
      status: 'failed',
      processedNewCount: 0,
      processedDuplicateCount: 0,
      processedErrorCount: 1,
      metadata: params.apifyRunId ? { apifyRunId: params.apifyRunId } : {},
      errors: [{ type: 'pipeline_failed', message }],
    });
  } catch {
    // best effort
  }
}

async function startTweetScraper(params: {
  maxItems: number;
  sort: 'Top' | 'Latest';
  tweetLanguage?: string;
  minRetweets?: number;
  minFavorites?: number;
  minReplies?: number;
}): Promise<{ runId: string; actorId: string; status: string; url: string; startedAt: string }>
{
  const env = getApifyEnv();
  const actorPath = env.actorId.replace(/\//g, '~');
  const requestUrl = new URL(`https://api.apify.com/v2/acts/${actorPath}/runs`);

  const keywords = await resolveKeywords();

  const requestBody = {
    searchTerms: keywords,
    maxItems: params.maxItems,
    tweetLanguage: params.tweetLanguage,
    sort: params.sort,
    includeSearchTerms: true,
    minimumRetweets: params.minRetweets,
    minimumFavorites: params.minFavorites,
    minimumReplies: params.minReplies,
  };

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Apify run failed with status ${response.status}: ${errText}`);
  }

  const payload = (await response.json()) as {
    data: {
      id: string;
      actId: string;
      status: string;
      startedAt: string;
      details?: { startedAt?: string };
      urls?: { webUrl?: string };
    };
  };

  const data = payload.data;
  return {
    runId: data.id,
    actorId: data.actId,
    status: data.status,
    startedAt: data.details?.startedAt ?? data.startedAt,
    url: data.urls?.webUrl ?? `https://api.apify.com/v2/acts/${data.actId}/runs/${data.id}`,
  };
}

async function runTweetScraperOnce(params: {
  maxItems: number;
  sort: 'Top' | 'Latest';
  tweetLanguage?: string;
  minRetweets?: number;
  minFavorites?: number;
  minReplies?: number;
  triggerSource: string;
}) {
  const { maxItems, sort, tweetLanguage, minRetweets, minFavorites, minReplies, triggerSource } = params;
  const env = getApifyEnv();
  const actorPath = env.actorId.replace(/\//g, '~');
  const keywords = await resolveKeywords();

  // Try to reuse a recent Apify run to avoid duplicate cost
  let start: { runId: string; actorId: string; status: string; url: string; startedAt: string } | null = null;
  const reuseExisting = bool(process.env.COLLECTOR_REUSE_EXISTING, false);
  if (reuseExisting) {
    const last = await findLastApifyRunId(triggerSource);
    if (last) {
      start = {
        runId: last.runId,
        actorId: env.actorId,
        status: 'REUSED',
        startedAt: last.startedAt,
        url: `https://api.apify.com/v2/acts/${actorPath}/runs/${last.runId}`,
      };
    }
  }

  if (!start) {
    start = await startTweetScraper({
      maxItems,
      sort,
      tweetLanguage,
      minRetweets,
      minFavorites,
      minReplies,
    });
  }

  console.log('✅ Run started');
  console.log('---------------------------------');
  console.log(`Run ID: ${start.runId}`);
  console.log(`Actor ID: ${start.actorId}`);
  console.log(`Status: ${start.status}`);
  console.log(`URL: ${start.url}`);
  console.log(`Started At: ${start.startedAt}`);

  try {
    // Wait for completion
    const runInfo = await waitForRunCompletion(start.runId, env.token);

    // Fetch dataset
    const items = await fetchDatasetItems(runInfo.datasetId, env.token, maxItems);

    // Normalize + persist, then trigger sentiment
    const supabase = createSupabaseServiceClient();

    const candidateMap = new Map<string, { item: ApifyTweetItem; keywords: string[]; collectedAt: string }>();
    const errors: unknown[] = [];
    const nowIso = runInfo.finishedAt;

    for (const raw of items) {
      const item = raw as ApifyTweetItem;
      const collectedAt = (item as { collectedAt?: string }).collectedAt ?? nowIso;
      try {
        const platformId = extractPlatformId(item);
        if (candidateMap.has(platformId)) continue;
        candidateMap.set(platformId, { item, keywords, collectedAt });
      } catch (e) {
        errors.push({ type: 'normalization_precheck_failed', message: e instanceof Error ? e.message : String(e), item });
      }
    }

    const allPlatformIds = Array.from(candidateMap.keys());
    const existingPlatformIds = allPlatformIds.length > 0 ? await fetchExistingNormalizedIds(supabase, 'twitter', allPlatformIds) : new Set<string>();
    const newPlatformIds = allPlatformIds.filter(id => !existingPlatformIds.has(id));

    const normalizedPrototypes = new Map<string, NormalizedTweetInsert>();
    const internalRunId = randomUUID();
    // Ensure FK: record a running cron_run row with this internalRunId before inserting raw/normalized
    await recordRunStart({ id: internalRunId, triggerSource, keywords, apifyRunId: start.runId, startedAt: start.startedAt });

    for (const platformId of newPlatformIds) {
      const candidate = candidateMap.get(platformId);
      if (!candidate) continue;
      try {
        const proto = normalizeTweet(candidate.item, {
          runId: internalRunId,
          rawTweetId: null,
          collectedAt: candidate.collectedAt,
          keywords: candidate.keywords,
        });
        normalizedPrototypes.set(platformId, proto);
      } catch (e) {
        errors.push({ type: 'normalization_failed', platformId, message: e instanceof Error ? e.message : String(e) });
      }
    }

    const processedNewCount = normalizedPrototypes.size;
    const processedDuplicateCount = existingPlatformIds.size;
    const processedErrorCount = errors.length;
    const status = processedErrorCount === 0 ? 'succeeded' : (processedNewCount > 0 ? 'partial_success' : 'failed');

    const rawRows = Array.from(normalizedPrototypes.keys()).map((platformId) => {
      const c = candidateMap.get(platformId)!;
      return {
        runId: internalRunId,
        platform: 'twitter' as const,
        platformId,
        collectedAt: c.collectedAt,
        payload: { item: c.item, keywords: c.keywords, fetchedAt: c.collectedAt },
        ingestionReason: 'initial' as const,
      };
    });

    const rawRecords = rawRows.length > 0 ? await insertRawTweets(supabase, rawRows) : [];
    const rawIdByPlatform = new Map<string, string | null>();
    for (const r of rawRecords) rawIdByPlatform.set(r.platformId, r.id);

    const normalizedRows: NormalizedTweetInsert[] = Array.from(normalizedPrototypes.entries()).map(([platformId, proto]) => ({
      ...proto,
      rawTweetId: rawIdByPlatform.get(platformId) ?? null,
    }));

    if (normalizedRows.length > 0) {
      await insertNormalizedTweets(supabase, normalizedRows);
    }

    await insertCronRun(supabase, {
      triggerSource,
      keywordBatch: keywords,
      startedAt: start.startedAt,
      finishedAt: runInfo.finishedAt,
      status,
      processedNewCount,
      processedDuplicateCount,
      processedErrorCount,
      metadata: {
        apifyRunId: start.runId,
        datasetId: runInfo.datasetId,
        maxItemsRequested: maxItems,
        candidateCount: candidateMap.size,
        requestedAt: start.startedAt,
      },
      errors,
    });

    console.log('✅ Completed');
    console.log('---------------------------------');
    console.log(`New: ${processedNewCount}`);
    console.log(`Duplicates: ${processedDuplicateCount}`);
    console.log(`Errors: ${processedErrorCount}`);
  } catch (e) {
    await recordFailureRun({ triggerSource, keywords, startedAt: start.startedAt, apifyRunId: start.runId, error: e });
    throw e;
  }
}

async function main() {
  // Pre-flight env checks for Apify credentials (the handler will also validate)
  const missing: string[] = [];
  if (!process.env.APIFY_TOKEN) missing.push('APIFY_TOKEN');
  if (!process.env.APIFY_ACTOR_ID) missing.push('APIFY_ACTOR_ID');
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }

  // Ingestion options (env-driven; sensible defaults)
  const maxItems = clamp(Number.parseInt(process.env.COLLECTOR_MAX_ITEMS || '100', 10), 1, 1000);
  const useDateFiltering = bool(process.env.COLLECTOR_USE_DATE_FILTERING, false);
  const cooldownSeconds = clamp(Number.parseInt(process.env.COLLECTOR_COOLDOWN_SECONDS || '0', 10), 0, 3600);
  const sort = (process.env.COLLECTOR_SORT === 'Top' ? 'Top' : 'Latest') as 'Top' | 'Latest';
  const tweetLanguage = process.env.COLLECTOR_LANGUAGE || 'en';

  const minRetweets = process.env.COLLECTOR_MIN_RETWEETS ? clamp(Number.parseInt(process.env.COLLECTOR_MIN_RETWEETS, 10), 0, 1_000_000) : undefined;
  const minFavorites = process.env.COLLECTOR_MIN_FAVORITES ? clamp(Number.parseInt(process.env.COLLECTOR_MIN_FAVORITES, 10), 0, 1_000_000) : undefined;
  const minReplies = process.env.COLLECTOR_MIN_REPLIES ? clamp(Number.parseInt(process.env.COLLECTOR_MIN_REPLIES, 10), 0, 1_000_000) : undefined;

  const requestedBy = process.env.COLLECTOR_REQUESTED_BY || process.env.USER || undefined;
  const triggerSource = process.env.COLLECTOR_TRIGGER_SOURCE || 'manual-script';
  const dryRun = bool(process.env.COLLECTOR_DRY_RUN, false);

  const actorId = process.env.APIFY_ACTOR_ID ?? '';
  const isTweetScraper = /tweet-scraper/i.test(actorId);

  console.log('🚀 Starting Apify tweet collection');
  console.log('=================================');
  console.log(`Trigger: ${triggerSource}${dryRun ? ' (dry run)' : ''}`);
  console.log(`Actor: ${actorId}`);
  console.log(`Max Items: ${maxItems}`);
  console.log(`Sort: ${sort}`);
  if (tweetLanguage) console.log(`Language: ${tweetLanguage}`);
  console.log(`Use Date Filtering: ${useDateFiltering}`);
  if (cooldownSeconds > 0) console.log(`Cooldown Seconds: ${cooldownSeconds}`);
  if (requestedBy) console.log(`Requested By: ${requestedBy}`);
  if (minRetweets != null || minFavorites != null || minReplies != null) {
    console.log(`Minimum Engagement: retweets=${minRetweets ?? 0}, favorites=${minFavorites ?? 0}, replies=${minReplies ?? 0}`);
  }
  console.log('');

  try {
    if (dryRun) {
      const now = new Date().toISOString();
      console.log('✅ Run started');
      console.log('---------------------------------');
      console.log(`Run ID: dryrun_${now}`);
      console.log(`Actor ID: ${actorId}`);
      console.log(`Status: DRY_RUN`);
      console.log(`URL: https://console.apify.com/`);
      console.log(`Started At: ${now}`);
      console.log('\nℹ️ Dry run: no Apify request was made.');
      return;
    }

    if (isTweetScraper) {
      const override = process.env.COLLECTOR_KEYWORDS && process.env.COLLECTOR_KEYWORDS.trim().length > 0;
      const hasProduct = !!(process.env.COLLECTOR_PRODUCT && process.env.COLLECTOR_PRODUCT.trim());

      if (!override && !hasProduct) {
        // Default: sequential runs per brand when no explicit product is provided
        const supabase = createSupabaseServiceClient();
        const products = await fetchDistinctEnabledProducts(supabase);
        for (const product of products) {
          console.log(`\n=== Collecting for brand: ${product} ===`);
          process.env.COLLECTOR_PRODUCT = product;
          await runTweetScraperOnce({
            maxItems,
            sort,
            tweetLanguage,
            minRetweets,
            minFavorites,
            minReplies,
            triggerSource,
          });
        }
        return;
      }

      // Single run for explicit product or keyword override
      await runTweetScraperOnce({
        maxItems,
        sort,
        tweetLanguage,
        minRetweets,
        minFavorites,
        minReplies,
        triggerSource,
      });
      return;
    }

    const result = await startApifyRunCommandHandler({
      triggerSource,
      requestedBy,
      dryRun: false,
      ingestion: {
        maxItems,
        sort,
        tweetLanguage,
        useDateFiltering,
        cooldownSeconds,
        minimumEngagement: {
          retweets: minRetweets,
          favorites: minFavorites,
          replies: minReplies,
        },
      },
      metadata: {},
    });

    console.log('✅ Run started');
    console.log('---------------------------------');
    console.log(`Run ID: ${result.runId}`);
    console.log(`Actor ID: ${result.actorId}`);
    console.log(`Status: ${result.status}`);
    console.log(`URL: ${result.url}`);
    console.log(`Started At: ${result.startedAt}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('❌ Failed to start Apify run:', msg);
    process.exit(1);
  }
}

main();
