#!/usr/bin/env npx tsx

/**
 * Validate RSS adapter output structure
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { isValidUnifiedEntry } from '@/contracts/unified-entry';
import type { UnifiedEntryBatch } from '@/contracts/unified-entry';

async function validateRSSOutput() {
  const today = new Date().toISOString().split('T')[0];
  const filename = `rss-${today}.json`;
  const filepath = join(process.cwd(), '.next', 'cache', filename);

  try {
    const data = await fs.readFile(filepath, 'utf-8');
    const batch: UnifiedEntryBatch = JSON.parse(data);

    console.log('🔍 Validating RSS adapter output...');
    console.log(`📄 File: ${filename}`);
    console.log(`📊 Total entries: ${batch.entries.length}`);
    console.log(`📅 Fetched at: ${batch.fetchedAt}`);
    console.log(`📋 Source: ${batch.source}`);

    // Validate batch structure
    if (batch.source !== 'rss') {
      throw new Error(`Invalid source type: ${batch.source}`);
    }

    if (!Array.isArray(batch.entries)) {
      throw new Error('Entries must be an array');
    }

    // Validate individual entries
    let validEntries = 0;
    const categories = new Map<string, number>();
    const sources = new Map<string, number>();

    for (const entry of batch.entries) {
      if (isValidUnifiedEntry(entry)) {
        validEntries++;

        // Count categories
        const categoryCount = categories.get(entry.category) || 0;
        categories.set(entry.category, categoryCount + 1);

        // Count feed sources
        const feedTitle = entry.metadata?.feedTitle || 'Unknown';
        const sourceCount = sources.get(feedTitle) || 0;
        sources.set(feedTitle, sourceCount + 1);
      } else {
        console.warn(`❌ Invalid entry: ${(entry as any)?.title || 'Unknown'}`);
      }
    }

    console.log(`✅ Valid entries: ${validEntries}/${batch.entries.length}`);

    console.log('\n📊 Categories:');
    for (const [category, count] of [...categories.entries()].sort()) {
      console.log(`   • ${category}: ${count} entries`);
    }

    console.log('\n📰 Sources:');
    for (const [source, count] of [...sources.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   • ${source}: ${count} entries`);
    }

    // Show sample entries
    console.log('\n📋 Sample entries:');
    batch.entries.slice(0, 3).forEach((entry, i) => {
      console.log(`   ${i + 1}. "${entry.title}" (${entry.category})`);
      console.log(`      📅 ${entry.publishedAt.split('T')[0]}`);
      console.log(`      🔗 ${entry.url}`);
    });

    if (batch.errors && batch.errors.length > 0) {
      console.log('\n⚠️  Errors during processing:');
      batch.errors.forEach(error => console.log(`   • ${error}`));
    }

    console.log('\n✅ RSS adapter output validation passed!');

  } catch (error) {
    console.error('❌ Validation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  validateRSSOutput();
}
