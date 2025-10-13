import { describe, it, expect } from 'vitest';
import { parseOpmlFileToInhouseFeeds } from '@/src/RssPipeline/ExternalServices/Miniflux/opml';

const OPML_PATH = 'src/RssPipeline/Data/miniflux-feeds.opml';

describe('OPML → InhouseFeedConfig parser', () => {
  it('parses feeds and maps categories from folder names', () => {
    const feeds = parseOpmlFileToInhouseFeeds(OPML_PATH);
    expect(feeds.length).toBeGreaterThan(0);

    const hasProduct = feeds.some(f => f.category === 'product_updates');
    const hasResearch = feeds.some(f => f.category === 'industry_research');
    const hasPerspectives = feeds.some(f => f.category === 'perspectives');

    expect(hasProduct).toBe(true);
    expect(hasResearch).toBe(true);
    expect(hasPerspectives).toBe(true);

    const hn = feeds.find(f => (f.title || '').toLowerCase().includes('hacker news'));
    expect(hn?.url).toBeTruthy();
  });
});
