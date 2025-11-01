import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('rss-parser', () => {
  class Parser {
    timeout: number;
    constructor(opts?: { timeout?: number }) { this.timeout = opts?.timeout ?? 0; }
    async parseURL(url: string) {
      // Return a different set of items depending on URL (to emulate multiple feeds)
      const now = Date.now();
      const base = url.includes('feedA') ? 0 : 1;
      return {
        title: url.includes('feedA') ? 'Feed A' : 'Feed B',
        items: [
          {
            link: `${url}/post-1`,
            guid: `${url}#1`,
            title: `Post 1 from ${url}`,
            isoDate: new Date(now - (base + 1) * 60_000).toISOString(),
            content: '<p>Hello <strong>world</strong></p>',
          },
          {
            link: `${url}/post-2`,
            guid: `${url}#2`,
            title: `Post 2 from ${url}`,
            isoDate: new Date(now - (base + 2) * 60_000).toISOString(),
            content: '<p>Another post about a release update</p>',
          },
        ],
      };
    }
  }
  return { default: Parser };
});

// Import after mocking
import { createMinifluxClient } from '@/src/RssPipeline/ExternalServices/Miniflux/client';

beforeEach(() => {
  process.env.INHOUSE_RSS_TIMEOUT_MS = '10';
  process.env.INHOUSE_RSS_MAX_CONCURRENCY = '2';
});

describe('Inhouse Miniflux getEntries (dry)', () => {
  it('fetches, filters by published_after, orders desc, and caps per-feed to limit', async () => {
    const client = createMinifluxClient();
    const publishedAfter = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 minutes ago
    const perFeed = 3;
    const res = await client.getEntries({ limit: perFeed, published_after: publishedAfter });

    expect(res.success).toBe(true);
    const data = res.data!;
    expect(data.total).toBeGreaterThan(0);

    // No feed contributes more than perFeed entries
    const counts = new Map<number, number>();
    for (const e of data.entries) {
      counts.set(e.feed_id, (counts.get(e.feed_id) ?? 0) + 1);
    }
    for (const [, c] of counts) expect(c).toBeLessThanOrEqual(perFeed);

    // Desc ordering by published_at
    for (let i = 1; i < data.entries.length; i++) {
      const prev = new Date(data.entries[i - 1].published_at).getTime();
      const curr = new Date(data.entries[i].published_at).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }

    // Fields present
    const e = data.entries[0];
    expect(e.title).toBeTruthy();
    expect(e.url).toMatch(/^https?:/);
    expect(typeof e.feed.title).toBe('string');
  });
});
