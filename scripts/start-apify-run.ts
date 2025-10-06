import { config } from 'dotenv';
import { startApifyRunCommandHandler } from '@/src/ApifyPipeline/Web/Application/Commands/StartApifyRun';

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

  console.log('🚀 Starting Apify tweet collection');
  console.log('=================================');
  console.log(`Trigger: ${triggerSource}${dryRun ? ' (dry run)' : ''}`);
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
    const result = await startApifyRunCommandHandler({
      triggerSource,
      requestedBy,
      dryRun,
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

    if (dryRun) {
      console.log('\nℹ️ Dry run: no Apify request was made.');
    }
  } catch (error) {
    console.error('❌ Failed to start Apify run:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
