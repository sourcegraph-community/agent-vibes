#!/usr/bin/env tsx

/**
 * Health Check Script for Apify Pipeline
 * Monitors critical components and alerts on issues
 */

import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Colors for output
const colors = {
  red: '\x1b[0;31m',
  yellow: '\x1b[1;33m',
  green: '\x1b[0;32m',
  reset: '\x1b[0m',
};

interface HealthCheckResult {
  name: string;
  status: 'ok' | 'warning' | 'critical';
  message: string;
  details?: Record<string, unknown>;
}

// Validate required environment variables
function validateEnvironment(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`${colors.red}❌ Missing required environment variables${colors.reset}`);
    console.error(`Required: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function printResult(result: HealthCheckResult): void {
  const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '🚨';
  const color = result.status === 'ok' ? colors.green : result.status === 'warning' ? colors.yellow : colors.red;

  console.log(`   ${color}${icon} ${result.message}${colors.reset}`);
}

async function checkSupabaseConnectivity(supabase: SupabaseClient): Promise<HealthCheckResult> {
  try {
    const { error } = await supabase.from('cron_runs').select('id').limit(1);

    if (error) {
      return {
        name: 'Supabase Connectivity',
        status: 'critical',
        message: `Supabase unreachable: ${error.message}`,
      };
    }

    return {
      name: 'Supabase Connectivity',
      status: 'ok',
      message: 'Supabase reachable',
    };
  } catch (err) {
    return {
      name: 'Supabase Connectivity',
      status: 'critical',
      message: `Supabase unreachable: ${(err as Error).message}`,
    };
  }
}

async function checkSentimentBacklog(supabase: SupabaseClient): Promise<HealthCheckResult> {
  try {
    const { count, error } = await supabase
      .from('normalized_tweets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_sentiment');

    if (error) {
      return {
        name: 'Sentiment Backlog',
        status: 'warning',
        message: `Could not check backlog: ${error.message}`,
      };
    }

    const pendingCount = count ?? 0;

    if (pendingCount < 100) {
      return {
        name: 'Sentiment Backlog',
        status: 'ok',
        message: `Backlog OK: ${pendingCount} pending tweets`,
        details: { pendingCount },
      };
    } else if (pendingCount < 200) {
      return {
        name: 'Sentiment Backlog',
        status: 'warning',
        message: `High backlog: ${pendingCount} pending tweets`,
        details: { pendingCount },
      };
    } else {
      return {
        name: 'Sentiment Backlog',
        status: 'critical',
        message: `Critical backlog: ${pendingCount} pending tweets`,
        details: { pendingCount },
      };
    }
  } catch (err) {
    return {
      name: 'Sentiment Backlog',
      status: 'warning',
      message: `Error checking backlog: ${(err as Error).message}`,
    };
  }
}

async function checkRecentCronFailures(supabase: SupabaseClient): Promise<HealthCheckResult> {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from('cron_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('started_at', twoHoursAgo);

    if (error) {
      return {
        name: 'Recent Cron Failures',
        status: 'warning',
        message: `Could not check cron failures: ${error.message}`,
      };
    }

    const failedCount = count ?? 0;

    if (failedCount === 0) {
      return {
        name: 'Recent Cron Failures',
        status: 'ok',
        message: 'No recent cron failures',
      };
    } else {
      return {
        name: 'Recent Cron Failures',
        status: 'critical',
        message: `Recent cron failures: ${failedCount}`,
        details: { failedCount },
      };
    }
  } catch (err) {
    return {
      name: 'Recent Cron Failures',
      status: 'warning',
      message: `Error checking failures: ${(err as Error).message}`,
    };
  }
}

async function checkLastSuccessfulCronRun(supabase: SupabaseClient): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabase
      .from('cron_runs')
      .select('started_at')
      .eq('status', 'succeeded')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        name: 'Last Successful Cron',
        status: 'warning',
        message: 'No successful cron runs found',
      };
    }

    const lastRunTime = new Date(data.started_at);
    const hoursAgo = Math.floor((Date.now() - lastRunTime.getTime()) / 1000 / 60 / 60);

    if (hoursAgo < 7) {
      return {
        name: 'Last Successful Cron',
        status: 'ok',
        message: `Last cron: ${hoursAgo} hours ago`,
        details: { lastRun: data.started_at, hoursAgo },
      };
    } else {
      return {
        name: 'Last Successful Cron',
        status: 'critical',
        message: `Last cron: ${hoursAgo} hours ago (stale)`,
        details: { lastRun: data.started_at, hoursAgo },
      };
    }
  } catch (err) {
    return {
      name: 'Last Successful Cron',
      status: 'warning',
      message: `Error checking last run: ${(err as Error).message}`,
    };
  }
}

async function checkSentimentFailures(supabase: SupabaseClient): Promise<HealthCheckResult> {
  try {
    const { count, error } = await supabase
      .from('sentiment_failures')
      .select('*', { count: 'exact', head: true })
      .gte('retry_count', 3);

    if (error) {
      return {
        name: 'Sentiment Failures',
        status: 'warning',
        message: `Could not check failures: ${error.message}`,
      };
    }

    const failuresCount = count ?? 0;

    if (failuresCount < 10) {
      return {
        name: 'Sentiment Failures',
        status: 'ok',
        message: `Failures OK: ${failuresCount} with 3+ retries`,
        details: { failuresCount },
      };
    } else if (failuresCount < 50) {
      return {
        name: 'Sentiment Failures',
        status: 'warning',
        message: `High failures: ${failuresCount} with 3+ retries`,
        details: { failuresCount },
      };
    } else {
      return {
        name: 'Sentiment Failures',
        status: 'critical',
        message: `Critical failures: ${failuresCount} with 3+ retries`,
        details: { failuresCount },
      };
    }
  } catch (err) {
    return {
      name: 'Sentiment Failures',
      status: 'warning',
      message: `Error checking failures: ${(err as Error).message}`,
    };
  }
}

async function checkBackfillQueue(supabase: SupabaseClient): Promise<HealthCheckResult> {
  try {
    const { count, error } = await supabase
      .from('backfill_batches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    if (error) {
      return {
        name: 'Backfill Queue',
        status: 'warning',
        message: `Could not check backfill queue: ${error.message}`,
      };
    }

    const backfillFailed = count ?? 0;

    if (backfillFailed === 0) {
      return {
        name: 'Backfill Queue',
        status: 'ok',
        message: 'No failed backfill batches',
      };
    } else {
      return {
        name: 'Backfill Queue',
        status: 'warning',
        message: `Failed backfill batches: ${backfillFailed}`,
        details: { backfillFailed },
      };
    }
  } catch (err) {
    return {
      name: 'Backfill Queue',
      status: 'warning',
      message: `Error checking queue: ${(err as Error).message}`,
    };
  }
}

async function main(): Promise<void> {
  console.log('=== Apify Pipeline Health Check ===');
  console.log(`Timestamp: ${formatTimestamp()}`);
  console.log('');

  // Validate environment
  validateEnvironment();

  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Track overall health status
  let overallHealth: 'ok' | 'warning' | 'critical' = 'ok';

  // Run all health checks
  const checks = [
    { name: 'Supabase connectivity', fn: () => checkSupabaseConnectivity(supabase) },
    { name: 'Sentiment processing backlog', fn: () => checkSentimentBacklog(supabase) },
    { name: 'Recent cron failures', fn: () => checkRecentCronFailures(supabase) },
    { name: 'Last successful cron run', fn: () => checkLastSuccessfulCronRun(supabase) },
    { name: 'Sentiment processing failures', fn: () => checkSentimentFailures(supabase) },
    { name: 'Backfill queue status', fn: () => checkBackfillQueue(supabase) },
  ];

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];
    console.log(`${i + 1}. Checking ${check.name}...`);

    const result = await check.fn();
    printResult(result);

    // Update overall health
    if (result.status === 'critical') {
      overallHealth = 'critical';
    } else if (result.status === 'warning' && overallHealth !== 'critical') {
      overallHealth = 'warning';
    }
  }

  // Summary
  console.log('');
  console.log('=== Health Check Summary ===');

  if (overallHealth === 'ok') {
    console.log(`${colors.green}✅ All systems healthy${colors.reset}`);
    process.exit(0);
  } else if (overallHealth === 'warning') {
    console.log(`${colors.yellow}⚠️  Warning: Some issues detected${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.red}🚨 Critical: Immediate attention required${colors.reset}`);
    process.exit(2);
  }
}

// Run health check
main().catch((err: Error) => {
  console.error(`${colors.red}❌ Health check failed: ${err.message}${colors.reset}`);
  process.exit(2);
});
