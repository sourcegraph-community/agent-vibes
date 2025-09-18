import { Knock } from '@knocklabs/node';
import type { EntryDraft } from '@/types/sources';

let knockClient: Knock | null = null;

function getKnockClient(): Knock | null {
  if (!knockClient && process.env.KNOCK_SECRET_API_KEY) {
    try {
      knockClient = new Knock({
        apiKey: process.env.KNOCK_SECRET_API_KEY,
      });
    } catch (error) {
      console.error('Failed to initialize Knock client:', error);
      return null;
    }
  }
  return knockClient;
}

export interface NotificationStats {
  totalSent: number;
  errors: string[];
  workflows: string[];
}

/**
 * Send notifications for new entries
 */
export async function sendNewEntriesNotification(
  entries: EntryDraft[],
  recipients: string[] = ['dashboard-subscribers'],
): Promise<NotificationStats> {
  const stats: NotificationStats = {
    totalSent: 0,
    errors: [],
    workflows: [],
  };

  if (entries.length === 0) {
    return stats;
  }

  const knock = getKnockClient();
  if (!knock) {
    stats.errors.push('Knock client not available - check KNOCK_SECRET_API_KEY');
    return stats;
  }

  try {
    // Group entries by source for better notification organization
    const entriesBySource = new Map<string, EntryDraft[]>();
    entries.forEach(entry => {
      const sourceName = extractSourceFromUrl(entry.url);
      const existing = entriesBySource.get(sourceName) || [];
      existing.push(entry);
      entriesBySource.set(sourceName, existing);
    });

    // Send notifications for high-value entries
    const highValueEntries = entries.filter(isHighValueEntry);
    if (highValueEntries.length > 0) {
      await knock.workflows.trigger('new-high-value-entries', {
        recipients,
        data: {
          count: highValueEntries.length,
          entries: highValueEntries.slice(0, 5).map(entry => ({
            title: entry.title,
            url: entry.url,
            source: extractSourceFromUrl(entry.url),
            summary: entry.summary?.substring(0, 100),
          })),
          totalCount: entries.length,
        },
      });
      stats.totalSent++;
      stats.workflows.push('new-high-value-entries');
    }

    // Send daily digest notification if many entries
    if (entries.length >= 10) {
      const sourceStats = Array.from(entriesBySource.entries()).map(([source, entries]) => ({
        source,
        count: entries.length,
        latestTitle: entries[0]?.title,
      }));

      await knock.workflows.trigger('daily-digest', {
        recipients,
        data: {
          totalEntries: entries.length,
          sources: sourceStats,
          topEntry: entries[0] ? {
            title: entries[0].title,
            url: entries[0].url,
            summary: entries[0].summary?.substring(0, 150),
          } : null,
        },
      });
      stats.totalSent++;
      stats.workflows.push('daily-digest');
    }

    // Send breaking news notifications for urgent updates
    const urgentEntries = entries.filter(isUrgentEntry);
    if (urgentEntries.length > 0) {
      for (const entry of urgentEntries.slice(0, 3)) { // Limit to 3 urgent notifications
        await knock.workflows.trigger('urgent-update', {
          recipients,
          data: {
            title: entry.title,
            url: entry.url,
            source: extractSourceFromUrl(entry.url),
            summary: entry.summary,
            tags: entry.tags?.join(', ') || '',
          },
        });
        stats.totalSent++;
      }
      if (urgentEntries.length > 0) {
        stats.workflows.push('urgent-update');
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown notification error';
    console.error('Failed to send notifications:', error);
    stats.errors.push(errorMsg);
  }

  return stats;
}

/**
 * Subscribe a user to dashboard notifications
 */
export async function subscribeUserToNotifications(userId: string, preferences: any = {}) {
  const knock = getKnockClient();
  if (!knock) {
    throw new Error('Knock client not available');
  }

  try {
    // Identify the user
    await knock.users.identify(userId, {
      name: preferences.name || `User ${userId}`,
      email: preferences.email,
    });

    // Set user preferences
    await knock.users.setPreferences(userId, {
      workflows: {
        'new-high-value-entries': {
          channel_types: { web_push: true, email: false },
        },
        'daily-digest': {
          channel_types: { web_push: true, email: true },
        },
        'urgent-update': {
          channel_types: { web_push: true, email: false, sms: false },
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to subscribe user:', error);
    throw error;
  }
}

/**
 * Helper functions for entry classification
 */
function isHighValueEntry(entry: EntryDraft): boolean {
  const title = entry.title.toLowerCase();
  const content = (entry.summary || entry.content || '').toLowerCase();

  // High-value indicators
  const highValueKeywords = [
    'breaking', 'major', 'release', 'launch', 'announce', 'funding',
    'acquisition', 'partnership', 'breakthrough', 'security',
  ];

  return highValueKeywords.some(keyword =>
    title.includes(keyword) || content.includes(keyword),
  );
}

function isUrgentEntry(entry: EntryDraft): boolean {
  const title = entry.title.toLowerCase();
  const content = (entry.summary || entry.content || '').toLowerCase();

  // Urgent indicators
  const urgentKeywords = [
    'breaking', 'urgent', 'critical', 'security', 'vulnerability',
    'outage', 'incident', 'emergency',
  ];

  return urgentKeywords.some(keyword =>
    title.includes(keyword) || content.includes(keyword),
  );
}

function extractSourceFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch {
    return 'unknown';
  }
}

/**
 * Test notification function for development
 */
export async function sendTestNotification(userId?: string) {
  const knock = getKnockClient();
  if (!knock) {
    throw new Error('Knock client not available');
  }

  const testEntry: EntryDraft = {
    title: 'AgentVibes Test Notification',
    url: 'https://agentvibes.com/test',
    publishedAt: new Date(),
    summary: 'This is a test notification to verify the AgentVibes notification system is working.',
    tags: ['test'],
  };

  return sendNewEntriesNotification([testEntry], userId ? [userId] : ['dashboard-subscribers']);
}
