#!/usr/bin/env node

/**
 * Test individual AgentVibes components
 */

async function testSpecificSource() {
  console.log('🧪 Testing specific RSS source...\n');

  try {
    const { RSSSourceHandler } = require('../lib/sources/rss');

    // Test GitHub changelog
    const handler = new RSSSourceHandler('https://github.blog/changelog/feed/', ['github', 'copilot']);
    const entries = await handler.fetchLatest();

    console.log(`✅ GitHub RSS: Fetched ${entries.length} entries`);
    if (entries.length > 0) {
      console.log(`   Latest: "${entries[0].title}"`);
      console.log(`   Published: ${entries[0].publishedAt}`);
      console.log(`   URL: ${entries[0].url}`);
    }
  } catch (error) {
    console.error('❌ RSS Source test failed:', error.message);
  }
}

async function testIngestionFlow() {
  console.log('\n🔄 Testing ingestion flow...\n');

  try {
    const { prisma } = require('../lib/db');
    const { initializeSourcesFromConfig } = require('../lib/ingest/utils');

    // Initialize sources
    await initializeSourcesFromConfig();

    const sources = await prisma.source.findMany({ where: { isActive: true } });
    console.log(`✅ Sources initialized: ${sources.length} active sources`);

    sources.slice(0, 3).forEach(source => {
      console.log(`   • ${source.name} (${source.type})`);
    });

  } catch (error) {
    console.error('❌ Ingestion flow test failed:', error.message);
  }
}

async function testNotifications() {
  console.log('\n🔔 Testing notification system...\n');

  try {
    const { sendTestNotification } = require('../lib/notifications');

    if (!process.env.KNOCK_SECRET_API_KEY) {
      console.log('⚠️  Knock API key not set - notification test skipped');
      console.log('   Set KNOCK_SECRET_API_KEY to test notifications');
      return;
    }

    const stats = await sendTestNotification();
    console.log('✅ Notification test completed:', stats);

  } catch (error) {
    console.error('❌ Notification test failed:', error.message);
  }
}

async function main() {
  await testSpecificSource();
  await testIngestionFlow();
  await testNotifications();

  console.log('\n🎉 Component testing complete!');
}

main().catch(console.error);
