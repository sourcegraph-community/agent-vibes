import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    const { count: pendingCount } = await supabase
      .from('rss_entries')
      .select('*', { count: 'exact', head: true })
      .eq('summary_status', 'pending');

    const { count: totalLast24h } = await supabase
      .from('rss_entries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    const { count: failedLast24h } = await supabase
      .from('rss_entries')
      .select('*', { count: 'exact', head: true })
      .eq('summary_status', 'failed')
      .gte('created_at', twentyFourHoursAgo);

    const { count: stuckEntries } = await supabase
      .from('rss_entries')
      .select('*', { count: 'exact', head: true })
      .eq('summary_status', 'processing')
      .lt('updated_at', thirtyMinutesAgo);

    const failureRate = (totalLast24h ?? 0) > 0
      ? ((failedLast24h ?? 0) / (totalLast24h ?? 0)) * 100
      : 0;

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if ((pendingCount ?? 0) > 500) {
      issues.push(`Critical: ${pendingCount} pending entries (threshold: 500)`);
      status = 'critical';
    }
    if ((pendingCount ?? 0) > 200 && (pendingCount ?? 0) <= 500) {
      issues.push(`Warning: ${pendingCount} pending entries (threshold: 200)`);
      if (status === 'healthy') status = 'warning';
    }

    if (failureRate > 25) {
      issues.push(`Critical: ${failureRate.toFixed(1)}% failure rate (threshold: 25%)`);
      status = 'critical';
    }
    if (failureRate > 10 && failureRate <= 25) {
      issues.push(`Warning: ${failureRate.toFixed(1)}% failure rate (threshold: 10%)`);
      if (status === 'healthy') status = 'warning';
    }

    if ((stuckEntries ?? 0) > 10) {
      issues.push(`Critical: ${stuckEntries} stuck entries (threshold: 10)`);
      status = 'critical';
    }
    if ((stuckEntries ?? 0) > 5 && (stuckEntries ?? 0) <= 10) {
      issues.push(`Warning: ${stuckEntries} stuck entries (threshold: 5)`);
      if (status === 'healthy') status = 'warning';
    }

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        pendingEntries: {
          count: pendingCount ?? 0,
          warningThreshold: 200,
          criticalThreshold: 500,
          alert: (pendingCount ?? 0) > 200,
        },
        failureRate: {
          rate: parseFloat(failureRate.toFixed(2)),
          failedCount: failedLast24h ?? 0,
          totalCount: totalLast24h ?? 0,
          period: '24h',
          warningThreshold: 10,
          criticalThreshold: 25,
          alert: failureRate > 10,
        },
        stuckEntries: {
          count: stuckEntries ?? 0,
          processingTimeThreshold: '30 minutes',
          warningThreshold: 5,
          criticalThreshold: 10,
          alert: (stuckEntries ?? 0) > 5,
        },
      },
      issues: issues.length > 0 ? issues : ['All systems operational'],
    });
  } catch (err) {
    const error = err as Error;
    console.error('RSS health check error:', error);
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
