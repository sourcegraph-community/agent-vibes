import { config } from 'dotenv';
import { startApifyRunCommandHandler } from '@/src/ApifyPipeline/Web/Application/Commands/StartApifyRun';
import { getApifyEnv } from '@/src/ApifyPipeline/Infrastructure/Config/env';
import { createSupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';
import { fetchEnabledKeywords } from '@/src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository';

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
    const kws = await fetchEnabledKeywords(supabase);
    if (kws.length > 0) return kws;
  } catch (_) {
    // fall through to defaults
  }

  return [
    'ampcode.com',
    '"ampcode"',
    '"sourcegraph amp"',
    '(to:ampcode)',
  ];
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
  const tweetLanguage = process.env.COLLECTOR_LANGUAGE || undefined;

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
      const result = await startTweetScraper({
        maxItems,
        sort,
        tweetLanguage,
        minRetweets,
        minFavorites,
        minReplies,
      });

      console.log('✅ Run started');
      console.log('---------------------------------');
      console.log(`Run ID: ${result.runId}`);
      console.log(`Actor ID: ${result.actorId}`);
      console.log(`Status: ${result.status}`);
      console.log(`URL: ${result.url}`);
      console.log(`Started At: ${result.startedAt}`);
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
    console.error('❌ Failed to start Apify run:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
