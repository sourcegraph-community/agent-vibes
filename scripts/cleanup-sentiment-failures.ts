import { createClient } from '@supabase/supabase-js';

interface CleanupOptions {
  dryRun?: boolean;
  retentionDays?: number;
}

async function cleanupSentimentFailures(options: CleanupOptions = {}) {
  const dryRun = options.dryRun ?? false;
  const retentionDays = options.retentionDays ?? 30;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Cleaning up sentiment failures...');
  console.log(`Dry run: ${dryRun}`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data: failures, error: fetchError } = await supabase
    .from('sentiment_failures')
    .select('id, normalized_tweet_id, last_attempt_at')
    .lt('last_attempt_at', cutoffDate.toISOString());

  if (fetchError) {
    throw new Error(`Failed to fetch failures: ${fetchError.message}`);
  }

  if (!failures || failures.length === 0) {
    console.log('No sentiment failures to clean up');
    return;
  }

  const resolvedIds: string[] = [];
  const unresolvedIds: string[] = [];

  for (const failure of failures) {
    const { data: sentiment } = await supabase
      .from('tweet_sentiments')
      .select('processed_at')
      .eq('normalized_tweet_id', failure.normalized_tweet_id)
      .gt('processed_at', failure.last_attempt_at)
      .single();

    if (sentiment) {
      resolvedIds.push(failure.id);
    }
    else {
      unresolvedIds.push(failure.id);
    }
  }

  console.log(`\nFound ${failures.length} old sentiment failures:`);
  console.log(`- ${resolvedIds.length} resolved (have successful sentiment)`);
  console.log(`- ${unresolvedIds.length} unresolved (no successful sentiment)`);

  if (dryRun) {
    console.log('\nDry run mode - no deletion performed');
    return;
  }

  if (resolvedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('sentiment_failures')
      .delete()
      .in('id', resolvedIds);

    if (deleteError) {
      throw new Error(`Failed to delete resolved failures: ${deleteError.message}`);
    }

    console.log(`\n✓ Deleted ${resolvedIds.length} resolved sentiment failures`);
  }

  console.log(`\n⚠️ Kept ${unresolvedIds.length} unresolved failures (consider manual review)`);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const retentionDays = args.includes('--retention-days')
  ? Number.parseInt(args[args.indexOf('--retention-days') + 1])
  : undefined;

cleanupSentimentFailures({ dryRun, retentionDays }).catch((err: Error) => {
  console.error('Error:', err.message);
  process.exit(1);
});
