import { config } from 'dotenv';
import { parseOpmlFileToInhouseFeeds } from '@/src/RssPipeline/ExternalServices/Miniflux/opml';
import { createMinifluxClient } from '@/src/RssPipeline/ExternalServices/Miniflux/client';
import { stripHtml, truncateContent } from '@/src/RssPipeline/Core/Transformations/htmlStripper';
import { inferCategory } from '@/src/RssPipeline/Core/Transformations/categoryMapper';
import { join } from 'node:path';
import { discoverOpmlFiles } from '@/src/Shared/Infrastructure/Utilities/opmlDiscovery';

config({ path: '.env.local' });

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function main() {
  const OPML_DIRS = [
    join(process.cwd(), 'src/RssPipeline/Data'),
  ];
  const opmlPaths = discoverOpmlFiles(OPML_DIRS);
  const limitEnv = process.env.RSS_SYNC_LIMIT;
  const parsedLimit = limitEnv ? Number.parseInt(limitEnv, 10) : NaN;
  const limit = clamp(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1, 500);

  const sinceDaysEnv = process.env.RSS_SYNC_SINCE_DAYS;
  const sinceDays = sinceDaysEnv ? clamp(Number.parseInt(sinceDaysEnv, 10), 1, 90) : 7;

  const timeoutMs = process.env.INHOUSE_RSS_TIMEOUT_MS || '20000';
  const maxConc = process.env.INHOUSE_RSS_MAX_CONCURRENCY || '5';

  const feeds = opmlPaths.flatMap((p) => parseOpmlFileToInhouseFeeds(p));
  if (feeds.length === 0) {
    console.error('❌ No feeds found in OPML directories. Add .opml files under src/RssPipeline/Data');
    process.exit(1);
  }

  process.env.INHOUSE_RSS_TIMEOUT_MS = timeoutMs;
  process.env.INHOUSE_RSS_MAX_CONCURRENCY = maxConc;

  console.log('🧪 Dry-run Inhouse Miniflux (no Supabase, no sentiment)');
  console.log('====================================================');
  console.log(`Feeds: ${feeds.length}`);
  console.log(`Per-feed limit: ${limit}`);
  console.log(`Since Days: ${sinceDays}`);
  console.log(`OPML: ${opmlPaths.join(', ')}`);
  console.log(`Theoretical max fetched: ${feeds.length * limit}`);
  console.log('');

  const miniflux = createMinifluxClient();

  const publishedAfter = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await miniflux.getEntries({ limit, published_after: publishedAfter, direction: 'desc' });

  if (!result.success || !result.data) {
    console.error('❌ Failed to collect entries:', result.error?.message);
    process.exit(1);
  }

  const { total, entries } = result.data;

  console.log('✅ Fetch Complete');
  console.log('----------------------------------------------------');
  console.log(`Total collected (after filters): ${total}`);
  console.log(`Showing: ${entries.length}`);

  // Preview a few entries with derived category & content preview
  const previewCount = Math.min(entries.length, 10);
  if (previewCount > 0) {
    console.log('\nSample entries:');
    for (let i = 0; i < previewCount; i++) {
      const e = entries[i];
      const stripped = stripHtml(e.content);
      const category = inferCategory(e.title, stripped, e.feed.title);
      console.log(`\n#${i + 1}`);
      console.log(`Feed: ${e.feed.title}`);
      console.log(`Title: ${e.title}`);
      console.log(`URL: ${e.url}`);
      console.log(`Published: ${e.published_at}`);
      console.log(`Category(inferred): ${category}`);
      console.log(`Preview: ${truncateContent(stripped, 180)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
