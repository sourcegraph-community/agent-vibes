import { prisma } from '@/lib/db';
import { RSSSourceHandler } from '@/lib/sources/rss';
import { createApifyHandler } from '@/lib/sources/apify';
import { HackerNewsSourceHandler } from '@/lib/sources/hackernews';
import { createChangelogHandler } from '@/lib/sources/changelog';
import type { SourceHandler, EntryDraft, CrawlResult } from '@/types/sources';
import type { Source } from '@prisma/client';

export async function createSourceHandler(source: Source): Promise<SourceHandler | null> {
  try {
    const keywords = source.keywords ? JSON.parse(source.keywords) : [];

    switch (source.type) {
      case 'RSS':
        return new RSSSourceHandler(source.endpoint, keywords);

      case 'API':
        // Hacker News API
        if (source.endpoint.includes('hn.algolia.com')) {
          return new HackerNewsSourceHandler(keywords);
        }

        // Use Apify for Reddit (only if APIFY_TOKEN is available)
        if (source.endpoint.includes('reddit.com/r/') && process.env.APIFY_TOKEN) {
          try {
            const subreddit = source.endpoint.split('/r/')[1];
            return createApifyHandler('reddit', { subreddit, keywords });
          } catch (error) {
            console.warn(`Apify handler failed for ${source.name}, skipping:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
          }
        }

        // Skip Reddit sources if no Apify token
        if (source.endpoint.includes('reddit.com/r/')) {
          console.warn(`${source.name} requires APIFY_TOKEN - skipping`);
          return null;
        }

        // TODO: Implement other API handlers (ProductHunt, etc.)
        console.warn(`API handler not implemented for ${source.name}`);
        return null;

      case 'SCRAPE':
        // Use changelog handlers for changelog pages
        return createChangelogHandler(source.endpoint, keywords);

      default:
        console.error(`Unknown source type: ${source.type}`);
        return null;
    }
  } catch (error) {
    console.error(`Failed to create handler for ${source.name}:`, error);
    return null;
  }
}

export async function crawlSource(source: Source): Promise<CrawlResult> {
  const startTime = Date.now();

  try {
    const handler = await createSourceHandler(source);
    if (!handler) {
      throw new Error(`No handler available for source type: ${source.type}`);
    }

    // Fetch latest entries
    const drafts = await handler.fetchLatest(source.lastSeen || undefined);

    // Filter out duplicates based on URL
    const newDrafts: EntryDraft[] = [];
    for (const draft of drafts) {
      const existing = await prisma.entry.findFirst({
        where: {
          sourceId: source.id,
          url: draft.url,
        },
      });

      if (!existing) {
        newDrafts.push(draft);
      }
    }

    // Insert new entries
    if (newDrafts.length > 0) {
      await prisma.entry.createMany({
        data: newDrafts.map(draft => ({
          sourceId: source.id,
          title: draft.title,
          url: draft.url,
          slug: draft.slug,
          publishedAt: draft.publishedAt,
          summary: draft.summary,
          content: draft.content,
          tags: draft.tags ? JSON.stringify(draft.tags) : null,
        })),
      });

      // Update source's lastSeen timestamp
      const latestDate = new Date(Math.max(...newDrafts.map(d => d.publishedAt.getTime())));
      await prisma.source.update({
        where: { id: source.id },
        data: { lastSeen: latestDate },
      });
    }

    const durationMs = Date.now() - startTime;

    // Log the crawl
    await prisma.crawlLog.create({
      data: {
        sourceId: source.id,
        completedAt: new Date(),
        durationMs,
        status: 'SUCCESS',
        newCount: newDrafts.length,
      },
    });

    return {
      sourceId: source.id,
      newEntries: newDrafts,
      status: 'SUCCESS',
      durationMs,
    };

  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Log the failed crawl
    await prisma.crawlLog.create({
      data: {
        sourceId: source.id,
        completedAt: new Date(),
        durationMs,
        status: 'ERROR',
        newCount: 0,
        errorMsg,
      },
    });

    return {
      sourceId: source.id,
      newEntries: [],
      status: 'ERROR',
      error: errorMsg,
      durationMs,
    };
  }
}

export async function initializeSourcesFromConfig() {
  const { SOURCE_CONFIGS } = await import('@/lib/sources/config');

  for (const config of SOURCE_CONFIGS) {
    const existing = await prisma.source.findUnique({
      where: { name: config.name },
    });

    if (!existing) {
      await prisma.source.create({
        data: {
          name: config.name,
          type: config.type,
          endpoint: config.endpoint,
          keywords: config.keywords ? JSON.stringify(config.keywords) : null,
          isActive: config.isActive ?? true,
        },
      });
      console.log(`Created source: ${config.name}`);
    }
  }
}
