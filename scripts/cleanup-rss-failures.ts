import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

interface CleanupOptions {
  dryRun?: boolean;
  retentionDays?: number;
  maxAttempts?: number;
}

async function cleanupRssFailures(options: CleanupOptions = {}) {
  const dryRun = options.dryRun ?? false;
  const retentionDays = options.retentionDays ?? 30;
  const maxAttempts = options.maxAttempts ?? 3;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🧹 Cleaning up RSS summarization failures...');
  console.log('============================================');
  console.log(`Dry run: ${dryRun}`);
  console.log(`Retention days: ${retentionDays}`);
  console.log(`Max attempts: ${maxAttempts}`);
  console.log('');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const { data: failures, error: fetchError } = await supabase
    .from('rss_entries')
    .select('id, title, summary_status, summary_attempts, summary_error, updated_at, category')
    .eq('summary_status', 'error')
    .lt('updated_at', cutoffDate.toISOString())
    .gte('summary_attempts', maxAttempts);

  if (fetchError) {
    throw new Error(`Failed to fetch failures: ${fetchError.message}`);
  }

  if (!failures || failures.length === 0) {
    console.log('✓ No old RSS failures to clean up');
    return;
  }

  const resolvableIds: number[] = [];
  const unresolvedIds: number[] = [];

  for (const failure of failures) {
    const { data: resolved } = await supabase
      .from('rss_entries')
      .select('ai_summary')
      .eq('id', failure.id)
      .not('ai_summary', 'is', null)
      .single();

    if (resolved) {
      resolvableIds.push(failure.id);
    }
    else {
      unresolvedIds.push(failure.id);
    }
  }

  console.log(`Found ${failures.length} old RSS failures:`);
  console.log(`- ${resolvableIds.length} resolved (have AI summary)`);
  console.log(`- ${unresolvedIds.length} unresolved (no AI summary)`);
  console.log('');

  if (dryRun) {
    console.log('🔍 Dry run mode - showing failures without cleanup:');
    console.log('');

    if (resolvableIds.length > 0) {
      console.log('Would reset to pending (have summary but marked error):');
      const toReset = failures.filter(f => resolvableIds.includes(f.id));
      toReset.forEach(f => {
        console.log(`  - [${f.category}] ${f.title.substring(0, 60)}...`);
      });
      console.log('');
    }

    if (unresolvedIds.length > 0) {
      console.log('Would keep as error (review manually):');
      const toKeep = failures.filter(f => unresolvedIds.includes(f.id));
      toKeep.slice(0, 10).forEach(f => {
        console.log(`  - [${f.category}] ${f.title.substring(0, 60)}...`);
        console.log(`    Attempts: ${f.summary_attempts}, Error: ${f.summary_error?.substring(0, 80) || 'N/A'}`);
      });
      if (toKeep.length > 10) {
        console.log(`  ... and ${toKeep.length - 10} more`);
      }
      console.log('');
    }

    console.log('Run without --dry-run to perform cleanup');
    return;
  }

  if (resolvableIds.length > 0) {
    const { error: updateError } = await supabase
      .from('rss_entries')
      .update({
        summary_status: 'done',
        summary_attempts: 0,
        summary_error: null,
      })
      .in('id', resolvableIds);

    if (updateError) {
      throw new Error(`Failed to update resolved failures: ${updateError.message}`);
    }

    console.log(`✓ Reset ${resolvableIds.length} resolved failures to done status`);
  }

  console.log(`⚠️  Kept ${unresolvedIds.length} unresolved failures (consider manual review or retry)`);
  console.log('');
  console.log('💡 Tip: Use replay-failed-rss-summaries.ts to retry failures with attempts < max');
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const retentionDays = args.includes('--retention-days')
  ? Number.parseInt(args[args.indexOf('--retention-days') + 1])
  : undefined;
const maxAttempts = args.includes('--max-attempts')
  ? Number.parseInt(args[args.indexOf('--max-attempts') + 1])
  : undefined;

cleanupRssFailures({ dryRun, retentionDays, maxAttempts }).catch((err: Error) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
