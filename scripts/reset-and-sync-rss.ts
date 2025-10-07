#!/usr/bin/env tsx
/**
 * Reset RSS Entries and Sync Fresh Data
 * 
 * This script:
 * 1. Clears all existing RSS entries from the database
 * 2. Syncs fresh entries from Miniflux (last 30 days)
 * 
 * Usage:
 *   npm run reset-sync-rss
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';
import { createMinifluxClient } from '@/src/RssPipeline/ExternalServices/Miniflux/client';
import type { RssCategory } from '@/src/RssPipeline/Core/Models/RssEntry';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function clearRssEntries() {
  console.log('🗑️  Clearing existing RSS entries...');
  
  const { error } = await supabase
    .from('rss_entries')
    .delete()
    .neq('id', 0); // Delete all rows

  if (error) {
    throw new Error(`Failed to clear RSS entries: ${error.message}`);
  }

  console.log('✅ Cleared all RSS entries');
}

function normalizeCategoryTitle(categoryTitle: string): RssCategory {
  const normalized = categoryTitle.toLowerCase().trim();
  
  if (normalized.includes('product') || normalized.includes('update')) {
    return 'product_updates';
  }
  if (normalized.includes('research') || normalized.includes('paper')) {
    return 'industry_research';
  }
  if (normalized.includes('perspective') || normalized.includes('opinion')) {
    return 'perspectives';
  }
  
  return 'uncategorized';
}

async function syncFreshEntries() {
  console.log('\n🔄 Syncing fresh entries from Miniflux...');
  console.log('   Fetching entries from last 30 days\n');

  const miniflux = createMinifluxClient();
  
  // Calculate date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const publishedAfter = thirtyDaysAgo.toISOString();

  const result = await miniflux.getEntries({
    limit: 500,
    order: 'published_at',
    direction: 'desc',
    published_after: publishedAfter,
  });

  if (!result.success || !result.data) {
    throw new Error(`Failed to fetch entries from Miniflux: ${result.error?.message}`);
  }

  const { entries, total } = result.data;
  console.log(`📥 Fetched ${entries.length} entries (total available: ${total})`);

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    try {
      const category = entry.feed.category?.title 
        ? normalizeCategoryTitle(entry.feed.category.title)
        : 'uncategorized';

      const { error } = await supabase
        .from('rss_entries')
        .insert({
          feed_id: entry.feed_id.toString(),
          feed_title: entry.feed.title,
          entry_id: entry.id.toString(),
          title: entry.title,
          url: entry.url,
          author: entry.author || null,
          published_at: entry.published_at,
          content: entry.content || null,
          summary: null,
          category,
          collected_at: new Date().toISOString(),
          status: 'pending_summary',
        });

      if (error) {
        if (error.code === '23505') {
          skipped++;
        } else {
          errors.push(`Entry ${entry.id}: ${error.message}`);
        }
      } else {
        inserted++;
        if (inserted % 50 === 0) {
          console.log(`   ✓ Inserted ${inserted} entries...`);
        }
      }
    } catch (err) {
      errors.push(`Entry ${entry.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  console.log('\n✅ Sync completed');
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Error details (first 5):');
    errors.slice(0, 5).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err}`);
    });
  }

  // Show category breakdown
  console.log('\n📊 Category breakdown:');
  const { data: categoryStats } = await supabase
    .from('rss_entries')
    .select('category')
    .order('category');

  if (categoryStats) {
    const counts = categoryStats.reduce((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(counts).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} entries`);
    });
  }
}

async function main() {
  try {
    console.log('🔄 Reset and Sync RSS Entries');
    console.log('====================================\n');

    await clearRssEntries();
    await syncFreshEntries();

    console.log('\n✅ All done! Refresh your dashboard to see fresh data.');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
