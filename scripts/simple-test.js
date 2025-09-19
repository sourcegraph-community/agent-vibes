#!/usr/bin/env node

/**
 * Simple test that just verifies RSS parsing works
 */

async function testBasicRSS() {
  console.log('🧪 Testing Basic RSS Functionality\n');

  try {
    const Parser = require('rss-parser');
    const parser = new Parser();

    // Test a few reliable RSS sources
    const testSources = [
      { name: 'GitHub Changelog', url: 'https://github.blog/changelog/feed/' },
      { name: 'StackOverflow Blog', url: 'https://stackoverflow.blog/feed/' },
      { name: 'InfoQ AI/ML', url: 'https://www.infoq.com/ai-ml/rss/' },
    ];

    for (const source of testSources) {
      console.log(`🔍 Testing: ${source.name}`);
      console.log(`   URL: ${source.url}`);

      try {
        const feed = await parser.parseURL(source.url);
        console.log(`   ✅ Success: Found ${feed.items.length} items`);

        if (feed.items.length > 0) {
          const latest = feed.items[0];
          console.log(`   📄 Latest: "${latest.title}"`);
          console.log(`   📅 Date: ${latest.pubDate ? new Date(latest.pubDate).toISOString().split('T')[0] : 'No date'}`);
          console.log(`   🔗 URL: ${latest.link}`);
        }
        console.log();

      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        console.log();
      }

      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Basic RSS test complete!');
    console.log('💡 If you see entries above, RSS parsing is working');
    console.log('💡 Next: Run "npm run dev" and visit http://localhost:3000/dashboard');

  } catch (error) {
    console.error('❌ RSS test failed:', error.message);
    console.log('\n💡 Try running: npm install rss-parser');
  }
}

testBasicRSS().catch(console.error);
