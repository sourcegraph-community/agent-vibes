import Parser from 'rss-parser';
import type { GetEntriesParams, MinifluxEntriesResponse, MinifluxEntry } from './client';

export type InhouseCategory = 'product_updates' | 'industry_research' | 'perspectives' | 'uncategorized';

export interface InhouseFeedConfig {
  url: string;
  title?: string;
  category?: InhouseCategory;
}

interface ParsedFeedItem {
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  title?: string;
  creator?: string;
  author?: string;
  content?: string;
  summary?: string;
  ['content:encoded']?: string;
}

interface ParsedFeed {
  title?: string;
  items?: ParsedFeedItem[];
}

function getEnvTimeout(): number {
  const n = Number(process.env.INHOUSE_RSS_TIMEOUT_MS ?? '20000');
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

function getMaxConcurrency(): number {
  const n = Number(process.env.INHOUSE_RSS_MAX_CONCURRENCY ?? '5');
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 5;
}

const parser = new Parser({ timeout: getEnvTimeout() });

function stableHashInt(input: string): number {
  // 32-bit signed hash folded to positive integer
  let h = 0;
  for (let i = 0; i < input.length; i++) h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function parseFeedsEnv(): InhouseFeedConfig[] {
  const raw = process.env.INHOUSE_RSS_FEEDS ?? '[]';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('INHOUSE_RSS_FEEDS is invalid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('INHOUSE_RSS_FEEDS is empty or invalid');
  }
  return parsed as InhouseFeedConfig[];
}

async function parseOneFeed(feed: InhouseFeedConfig) {
  const data = (await parser.parseURL(feed.url)) as unknown as ParsedFeed;
  return { feed, data } as const;
}

async function withConcurrency<T>(items: T[], limit: number, fn: (t: T) => Promise<unknown>) {
  const queue = [...items];
  const results: PromiseSettledResult<unknown>[] = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) {
      const next = queue.shift()!;
      try {
        const v = await fn(next);
        results.push({ status: 'fulfilled', value: v });
      } catch (e) {
        results.push({ status: 'rejected', reason: e });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function asIso(dateLike: string | Date | undefined): string {
  const d = dateLike ? new Date(dateLike) : new Date();
  return new Date(d.getTime()).toISOString();
}

function pickContent(item: ParsedFeedItem): string {
  return (
    (item['content:encoded'] as string | undefined) ??
    (item.content as string | undefined) ??
    (item.summary as string | undefined) ??
    ''
  );
}

export async function getEntries(params: Partial<GetEntriesParams> = {}): Promise<MinifluxEntriesResponse> {
  const feeds = parseFeedsEnv();

  const results = (await withConcurrency(feeds, getMaxConcurrency(), (f) => parseOneFeed(f))) as Array<
    PromiseSettledResult<{ feed: InhouseFeedConfig; data: ParsedFeed }>
  >;

  const items: MinifluxEntry[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { feed, data } = r.value as unknown as { feed: InhouseFeedConfig; data: ParsedFeed };
    const channelTitle: string | undefined = data?.title;
    const feedId = stableHashInt(feed.url);
    const feedTitle = feed.title ?? channelTitle ?? (() => new URL(feed.url).host)();

    for (const item of data.items ?? []) {
      const link = (item.link ?? '') as string;
      const guid = (item.guid ?? link) as string;
      const publishedRaw = (item.isoDate ?? item.pubDate) as string | undefined;
      const publishedAt = asIso(publishedRaw);

      items.push({
        id: stableHashInt(`${guid}|${link}|${publishedAt}|${feed.url}`),
        user_id: 0,
        feed_id: feedId,
        title: (item.title as string) ?? '(untitled)',
        url: link,
        author: (item.creator as string) ?? (item.author as string) ?? '',
        content: pickContent(item),
        hash: '',
        published_at: publishedAt,
        created_at: asIso(undefined),
        status: 'unread',
        starred: false,
        reading_time: 0,
        feed: {
          id: feedId,
          title: feedTitle,
          category: feed.category ? { id: stableHashInt(feed.category), title: feed.category } : undefined,
        },
      });
    }
  }

  let list = items;

  if (params.published_after) {
    const afterMs = new Date(params.published_after).getTime();
    if (Number.isFinite(afterMs)) {
      list = list.filter((i) => new Date(i.published_at).getTime() >= afterMs);
    }
  }

  const direction = (params.direction ?? 'desc') as 'asc' | 'desc';
  // Only published_at ordering is supported in MVP
  list.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
  if (direction === 'desc') list.reverse();

  const total = list.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  const entries = list.slice(offset, offset + limit);

  return { total, entries };
}
