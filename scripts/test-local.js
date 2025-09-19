#!/usr/bin/env node

/**
 * Local testing script for AgentVibes
 */

console.log('🧪 Testing AgentVibes Sources\n');

async function testRSSSource() {
  try {
    console.log('📡 Testing RSS Parser...');
    const Parser = require('rss-parser');
    const parser = new Parser();

    // Test with a reliable RSS feed
    const feed = await parser.parseURL('https://github.blog/changelog/feed/');
    console.log(`✅ RSS Test: Found ${feed.items.length} items from GitHub changelog`);
    console.log(`   Latest: "${feed.items[0]?.title}"\n`);
  } catch (error) {
    console.error('❌ RSS Test failed:', error.message);
  }
}

async function testDatabase() {
  try {
    console.log('🗄️ Testing Database Connection...');
    const { prisma } = require('../lib/db');

    // Test database connection
    await prisma.$connect();

    // Count sources
    const sourceCount = await prisma.source.count();
    console.log(`✅ Database Test: Connected, ${sourceCount} sources configured\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database Test failed:', error.message);
    console.log('   Try running: npx prisma db push\n');
  }
}

async function testSourceConfig() {
  try {
    console.log('⚙️ Testing Source Configuration...');
    const { SOURCE_CONFIGS, getActiveRSSConfigs } = require('../lib/sources/config');

    const totalSources = SOURCE_CONFIGS.length;
    const activeSources = SOURCE_CONFIGS.filter(s => s.isActive).length;
    const rssFeeds = getActiveRSSConfigs().length;

    console.log(`✅ Config Test: ${totalSources} total sources, ${activeSources} active, ${rssFeeds} RSS feeds\n`);

    console.log('📋 Active RSS Sources:');
    getActiveRSSConfigs().slice(0, 5).forEach(source => {
      console.log(`   • ${source.name}: ${source.endpoint}`);
    });
    if (rssFeeds > 5) console.log(`   ... and ${rssFeeds - 5} more\n`);

  } catch (error) {
    console.error('❌ Config Test failed:', error.message);
  }
}

async function testAPI() {
  try {
    console.log('🌐 Testing API Endpoints...');

    // This will only work if the server is running
    const fetch = require('node-fetch').default || require('node-fetch');

    try {
      const response = await fetch('http://localhost:3000/api/entries?limit=1');
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ API Test: /api/entries returned ${data.entries?.length || 0} entries`);
      } else {
        console.log(`⚠️  API Test: Server returned ${response.status} (server may not be running)`);
      }
    } catch (err) {
      console.log('⚠️  API Test: Server not running (run npm run dev first)');
    }

    console.log();
  } catch (error) {
    console.error('❌ API Test failed:', error.message);
  }
}

async function runTests() {
  await testSourceConfig();
  await testRSSSource();
  await testDatabase();
  await testAPI();

  console.log('🎉 Testing complete!');
  console.log('💡 To start the server: npm run dev');
  console.log('💡 To test ingestion: npm run test-ingestion (server must be running)');
}

runTests().catch(console.error);
