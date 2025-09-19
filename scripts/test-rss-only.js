#!/usr/bin/env node

/**
 * Test just the RSS functionality without external dependencies
 */

async function testRSSIngestion() {
  console.log('🧪 Testing RSS-only ingestion...\n');

  try {
    // Test basic RSS parsing without database
    const Parser = require('rss-parser');
    const parser = new Parser();

    const rssSources = getActiveRSSConfigs();
    console.log(`📡 Found ${rssSources.length} active RSS sources`);

    // Test first 3 RSS sources to avoid rate limiting
    for (const sourceConfig of rssSources.slice(0, 3)) {
      console.log(`\n🔍 Testing: ${sourceConfig.name}`);
      console.log(`   URL: ${sourceConfig.endpoint}`);

      try {
        const handler = new RSSSourceHandler(sourceConfig.endpoint, sourceConfig.keywords || []);
        const entries = await handler.fetchLatest();

        console.log(`   ✅ Success: Found ${entries.length} entries`);
        if (entries.length > 0) {
          console.log(`   📄 Latest: "${entries[0].title}"`);
          console.log(`   📅 Date: ${entries[0].publishedAt.toISOString().split('T')[0]}`);
        }

        // Store first few entries to test database
        if (entries.length > 0) {
          // Create source if doesn't exist
          let source = await prisma.source.findUnique({
            where: { name: sourceConfig.name },
          });

          if (!source) {
            source = await prisma.source.create({
              data: {
                name: sourceConfig.name,
                type: sourceConfig.type,
                endpoint: sourceConfig.endpoint,
                keywords: sourceConfig.keywords ? JSON.stringify(sourceConfig.keywords) : null,
                isActive: true,
              },
            });
          }

          // Store first 2 entries
          for (const entry of entries.slice(0, 2)) {
            try {
              await prisma.entry.create({
                data: {
                  sourceId: source.id,
                  title: entry.title,
                  url: entry.url,
                  slug: entry.slug,
                  publishedAt: entry.publishedAt,
                  summary: entry.summary,
                  content: entry.content,
                  tags: entry.tags ? JSON.stringify(entry.tags) : null,
                },
              });
            } catch (err) {
              // Skip duplicates
              if (!err.message?.includes('Unique constraint')) {
                throw err;
              }
            }
          }
          console.log(`   💾 Stored ${Math.min(2, entries.length)} entries in database`);
        }

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }

      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Show final stats
    const totalEntries = await prisma.entry.count();
    const totalSources = await prisma.source.count();

    console.log(`\n📊 Final Stats:`);
    console.log(`   Sources: ${totalSources}`);
    console.log(`   Entries: ${totalEntries}`);
    console.log(`\n✅ RSS ingestion test complete!`);
    console.log(`💡 Visit http://localhost:3000/dashboard to see results`);

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ RSS test failed:', error);
  }
}

runTests = async () => {
  await testRSSIngestion();
};

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testRSSIngestion };
