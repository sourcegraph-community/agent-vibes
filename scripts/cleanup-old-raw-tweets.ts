import { createClient } from '@supabase/supabase-js';

interface CleanupOptions {
  dryRun?: boolean;
  retentionDays?: number;
  batchSize?: number;
}

async function cleanupOldRawTweets(options: CleanupOptions = {}) {
  const dryRun = options.dryRun ?? false;
  const retentionDays = options.retentionDays ?? 90;
  const batchSize = options.batchSize ?? 1000;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  console.log(`Cleaning up raw_tweets older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);
  console.log(`Dry run: ${dryRun}`);

  const { count, error: countError } = await supabase
    .from('raw_tweets')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoffDate.toISOString());

  if (countError) {
    throw new Error(`Failed to count old tweets: ${countError.message}`);
  }

  console.log(`Found ${count} raw tweets to clean up`);

  if (count === 0) {
    console.log('No tweets to clean up');
    return;
  }

  if (dryRun) {
    console.log('Dry run mode - no deletion performed');
    return;
  }

  let deletedTotal = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: tweets, error: fetchError } = await supabase
      .from('raw_tweets')
      .select('id')
      .lt('created_at', cutoffDate.toISOString())
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch tweets: ${fetchError.message}`);
    }

    if (!tweets || tweets.length === 0) {
      hasMore = false;
      break;
    }

    const ids = tweets.map((t) => t.id);

    const { error: deleteError } = await supabase
      .from('raw_tweets')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error(`Failed to delete batch: ${deleteError.message}`);
      break;
    }

    deletedTotal += tweets.length;
    console.log(`Deleted ${deletedTotal}/${count} tweets...`);

    if (tweets.length < batchSize) {
      hasMore = false;
    }
  }

  console.log(`✓ Cleanup complete. Deleted ${deletedTotal} raw tweets.`);
  console.log('Run VACUUM FULL raw_tweets; to reclaim storage.');
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const retentionDays = args.includes('--retention-days')
  ? Number.parseInt(args[args.indexOf('--retention-days') + 1])
  : undefined;

cleanupOldRawTweets({ dryRun, retentionDays }).catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
