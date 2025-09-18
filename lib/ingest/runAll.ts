import { prisma } from '@/lib/db';
import { crawlSource, initializeSourcesFromConfig } from './utils';
import type { CrawlResult } from '@/types/sources';

export interface IngestStats {
  totalSources: number;
  successfulSources: number;
  totalNewEntries: number;
  totalDuration: number;
  errors: string[];
}

export async function runAllIngestion(): Promise<IngestStats> {
  const startTime = Date.now();
  console.log('🚀 Starting ingestion run...');

  // Initialize sources from config if they don't exist
  await initializeSourcesFromConfig();

  // Get all active sources
  const sources = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  console.log(`📋 Found ${sources.length} active sources`);

  const results: CrawlResult[] = [];
  const errors: string[] = [];
  const allNewEntries: import('@/types/sources').EntryDraft[] = [];

  // Process sources concurrently (with limit)
  const CONCURRENT_LIMIT = 5;
  const batches = [];
  for (let i = 0; i < sources.length; i += CONCURRENT_LIMIT) {
    batches.push(sources.slice(i, i + CONCURRENT_LIMIT));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (source) => {
      console.log(`📡 Crawling ${source.name}...`);
      const result = await crawlSource(source);

      if (result.status === 'SUCCESS') {
        console.log(`✅ ${source.name}: ${result.newEntries.length} new entries`);
        allNewEntries.push(...result.newEntries);
      } else {
        console.error(`❌ ${source.name}: ${result.error}`);
        errors.push(`${source.name}: ${result.error}`);
      }

      return result;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Send notifications for all new entries
  if (allNewEntries.length > 0) {
    await triggerNewEntryNotifications(allNewEntries);
  }

  const stats: IngestStats = {
    totalSources: sources.length,
    successfulSources: results.filter(r => r.status === 'SUCCESS').length,
    totalNewEntries: results.reduce((sum, r) => sum + r.newEntries.length, 0),
    totalDuration: Date.now() - startTime,
    errors,
  };

  console.log('📊 Ingestion complete:', {
    successful: `${stats.successfulSources}/${stats.totalSources}`,
    newEntries: stats.totalNewEntries,
    duration: `${stats.totalDuration}ms`,
    errors: stats.errors.length,
  });

  return stats;
}

// Trigger notifications for new entries if configured
export async function triggerNewEntryNotifications(newEntries: import('@/types/sources').EntryDraft[]) {
  if (newEntries.length === 0) return;

  try {
    const { sendNewEntriesNotification } = await import('@/lib/notifications');

    const stats = await sendNewEntriesNotification(newEntries);

    console.log(`🔔 Notification stats:`, {
      sent: stats.totalSent,
      workflows: stats.workflows,
      errors: stats.errors,
    });

  } catch (error) {
    console.error('Failed to send notifications:', error);
  }
}
