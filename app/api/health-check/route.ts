import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // Check database connectivity
    const { error: dbError } = await supabase.from('cron_runs').select('id').limit(1);
    if (dbError) throw new Error(`Database check failed: ${dbError.message}`);

    // Check last cron run
    const { data: lastRun } = await supabase
      .from('cron_runs')
      .select('started_at, status')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    const hoursSinceLastRun = lastRun
      ? (Date.now() - new Date(lastRun.started_at).getTime()) / 1000 / 60 / 60
      : 999;

    // Check pending sentiment backlog
    const { count: pendingCount } = await supabase
      .from('normalized_tweets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_sentiment');

    // Check sentiment failures
    const { count: failuresCount } = await supabase
      .from('sentiment_failures')
      .select('*', { count: 'exact', head: true })
      .gte('retry_count', 3);

    // Check recent cron failures
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { count: recentFailures } = await supabase
      .from('cron_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('started_at', twoHoursAgo);

    // Check failed backfill batches
    const { count: failedBackfills } = await supabase
      .from('backfill_batches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    // Determine overall health status
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (hoursSinceLastRun > 7) {
      issues.push('Cron may be failing (last run >7 hours ago)');
      status = 'critical';
    }

    if ((pendingCount ?? 0) > 200) {
      issues.push(`High sentiment backlog: ${pendingCount} pending tweets`);
      status = status === 'critical' ? 'critical' : 'critical';
    } else if ((pendingCount ?? 0) > 100) {
      issues.push(`Elevated sentiment backlog: ${pendingCount} pending tweets`);
      status = status === 'critical' ? 'critical' : 'warning';
    }

    if ((recentFailures ?? 0) > 0) {
      issues.push(`Recent cron failures: ${recentFailures} in last 2 hours`);
      status = 'critical';
    }

    if ((failuresCount ?? 0) > 50) {
      issues.push(`High sentiment failures: ${failuresCount} with 3+ retries`);
      status = status === 'critical' ? 'critical' : 'warning';
    }

    if ((failedBackfills ?? 0) > 0) {
      issues.push(`Failed backfill batches: ${failedBackfills}`);
      status = status === 'critical' ? 'critical' : 'warning';
    }

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        lastCronRun: {
          timestamp: lastRun?.started_at ?? null,
          hoursSinceLastRun: Math.round(hoursSinceLastRun * 10) / 10,
          status: lastRun?.status ?? null,
        },
        sentimentBacklog: {
          pending: pendingCount ?? 0,
          threshold: 100,
          alert: (pendingCount ?? 0) > 100,
        },
        sentimentFailures: {
          count: failuresCount ?? 0,
          threshold: 50,
          alert: (failuresCount ?? 0) > 50,
        },
        cronFailures: {
          recentCount: recentFailures ?? 0,
          alert: (recentFailures ?? 0) > 0,
        },
        backfillQueue: {
          failedBatches: failedBackfills ?? 0,
          alert: (failedBackfills ?? 0) > 0,
        },
      },
      issues: issues.length > 0 ? issues : ['All systems operational'],
    });
  } catch (err) {
    const error = err as Error;
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
