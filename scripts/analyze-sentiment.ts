#!/usr/bin/env tsx

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import Sentiment from 'sentiment';
import slugify from 'slugify';

// Initialize sentiment analyzer
const sentiment = new Sentiment();

interface Tweet {
  id: string;
  text: string;
  fullText: string;
  createdAt: string;
  author: {
    userName: string;
    name: string;
  };
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number;
  url: string;
}

interface ProcessedTweet extends Tweet {
  sentiment: number;
  tool: string;
  cleanText: string;
  engagementScore: number;
}

// Tool detection patterns
const toolPatterns = [
  { pattern: /@?ampcode|amp code/i, tool: 'AmpCode' },
  { pattern: /cursor|cursor\.sh/i, tool: 'Cursor' },
  { pattern: /github copilot|copilot/i, tool: 'Copilot' },
  { pattern: /sourcegraph|cody/i, tool: 'Cody' },
  { pattern: /claude|anthropic/i, tool: 'Claude' },
  { pattern: /chatgpt|openai/i, tool: 'ChatGPT' },
  { pattern: /windsurf/i, tool: 'Windsurf' },
  { pattern: /replit/i, tool: 'Replit' },
];

function cleanText(text: string): string {
  return text
    // Remove URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove @mentions but keep the context
    .replace(/@\w+/g, '')
    // Remove hashtags but keep the text
    .replace(/#(\w+)/g, '$1')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function detectTool(text: string): string {
  const fullText = text.toLowerCase();

  for (const { pattern, tool } of toolPatterns) {
    if (pattern.test(fullText)) {
      return tool;
    }
  }

  return 'other';
}

function calculateEngagementScore(tweet: Tweet): number {
  // Weight different engagement types
  const likes = tweet.likeCount || 0;
  const retweets = (tweet.retweetCount || 0) * 3; // Retweets are more valuable
  const replies = (tweet.replyCount || 0) * 2;   // Replies show engagement
  const views = (tweet.viewCount || 0) * 0.01;   // Views are less valuable

  return likes + retweets + replies + views;
}

function processTweets(tweets: Tweet[]): ProcessedTweet[] {
  console.log(`Processing ${tweets.length} tweets for sentiment analysis...`);

  return tweets.map((tweet, index) => {
    if (index % 10 === 0) {
      console.log(`Processed ${index}/${tweets.length} tweets`);
    }

    const cleanedText = cleanText(tweet.fullText);
    const sentimentResult = sentiment.analyze(cleanedText);
    const tool = detectTool(tweet.fullText);
    const engagementScore = calculateEngagementScore(tweet);

    return {
      ...tweet,
      sentiment: sentimentResult.score,
      tool,
      cleanText: cleanedText,
      engagementScore,
    };
  });
}

function generateMetrics(processedTweets: ProcessedTweet[]) {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const metrics = {
    total: processedTweets.length,
    lastUpdated: now.toISOString(),

    // Overall sentiment
    overall: {
      avgSentiment: processedTweets.reduce((sum, t) => sum + t.sentiment, 0) / processedTweets.length,
      positive: processedTweets.filter(t => t.sentiment > 0).length,
      neutral: processedTweets.filter(t => t.sentiment === 0).length,
      negative: processedTweets.filter(t => t.sentiment < 0).length,
    },

    // By time windows
    windows: {} as Record<string, any>,

    // By tool
    byTool: {} as Record<string, any>,

    // Daily breakdown for charts
    daily: {} as Record<string, any>,
  };

  // Calculate time windows
  const windows = [
    { name: '24h', ms: oneDay },
    { name: '7d', ms: oneWeek },
    { name: '30d', ms: oneMonth },
  ];

  windows.forEach(({ name, ms }) => {
    const cutoff = new Date(now.getTime() - ms);
    const tweets = processedTweets.filter(t => new Date(t.createdAt) > cutoff);

    if (tweets.length > 0) {
      metrics.windows[name] = {
        count: tweets.length,
        avgSentiment: tweets.reduce((sum, t) => sum + t.sentiment, 0) / tweets.length,
        positive: tweets.filter(t => t.sentiment > 0).length,
        negative: tweets.filter(t => t.sentiment < 0).length,
      };
    }
  });

  // Calculate by tool
  const toolCounts = {} as Record<string, ProcessedTweet[]>;
  processedTweets.forEach(tweet => {
    if (!toolCounts[tweet.tool]) {
      toolCounts[tweet.tool] = [];
    }
    toolCounts[tweet.tool].push(tweet);
  });

  Object.entries(toolCounts).forEach(([tool, tweets]) => {
    metrics.byTool[tool] = {
      count: tweets.length,
      avgSentiment: tweets.reduce((sum, t) => sum + t.sentiment, 0) / tweets.length,
      positive: tweets.filter(t => t.sentiment > 0).length,
      negative: tweets.filter(t => t.sentiment < 0).length,
      totalEngagement: tweets.reduce((sum, t) => sum + t.engagementScore, 0),
    };
  });

  // Daily breakdown for trend charts
  const dailyBreakdown = {} as Record<string, any>;
  processedTweets.forEach(tweet => {
    const date = new Date(tweet.createdAt).toISOString().split('T')[0];

    if (!dailyBreakdown[date]) {
      dailyBreakdown[date] = { tweets: [], totalSentiment: 0 };
    }

    dailyBreakdown[date].tweets.push(tweet);
    dailyBreakdown[date].totalSentiment += tweet.sentiment;
  });

  Object.entries(dailyBreakdown).forEach(([date, data]) => {
    const tweets = data.tweets;
    metrics.daily[date] = {
      count: tweets.length,
      avgSentiment: data.totalSentiment / tweets.length,
      positive: tweets.filter((t: ProcessedTweet) => t.sentiment > 0).length,
      negative: tweets.filter((t: ProcessedTweet) => t.sentiment < 0).length,
    };
  });

  return metrics;
}

async function main() {
  try {
    console.log('🚀 Starting sentiment analysis...');

    // Read the X posts data
    const dataPath = join(process.cwd(), 'data', '2025-09-17-apify-x-posts-100.json');
    console.log(`Reading data from: ${dataPath}`);

    const rawData = readFileSync(dataPath, 'utf8');
    const tweets = JSON.parse(rawData) as Tweet[];

    console.log(`Loaded ${tweets.length} tweets`);

    // Process tweets
    const processedTweets = processTweets(tweets);

    // Generate metrics
    console.log('Generating metrics...');
    const metrics = generateMetrics(processedTweets);

    // Create output directory
    const cacheDir = join(process.cwd(), '.next', 'cache');
    mkdirSync(cacheDir, { recursive: true });

    // Write processed tweets
    const tweetsOutputPath = join(cacheDir, 'x-posts-sentiment.json');
    writeFileSync(tweetsOutputPath, JSON.stringify(processedTweets, null, 2));

    // Write metrics
    const metricsOutputPath = join(cacheDir, 'sentiment-metrics.json');
    writeFileSync(metricsOutputPath, JSON.stringify(metrics, null, 2));

    // Also create fallback files in public
    const publicDataDir = join(process.cwd(), 'public', 'data');
    mkdirSync(publicDataDir, { recursive: true });

    writeFileSync(join(publicDataDir, 'x-posts-sentiment.json'), JSON.stringify(processedTweets, null, 2));
    writeFileSync(join(publicDataDir, 'sentiment-metrics.json'), JSON.stringify(metrics, null, 2));

    // Summary
    console.log('\n✅ Sentiment analysis complete!');
    console.log(`📊 Total tweets: ${tweets.length}`);
    console.log(`📈 Average sentiment: ${metrics.overall.avgSentiment.toFixed(2)}`);
    console.log(`😊 Positive: ${metrics.overall.positive} (${((metrics.overall.positive / tweets.length) * 100).toFixed(1)}%)`);
    console.log(`😐 Neutral: ${metrics.overall.neutral} (${((metrics.overall.neutral / tweets.length) * 100).toFixed(1)}%)`);
    console.log(`😞 Negative: ${metrics.overall.negative} (${((metrics.overall.negative / tweets.length) * 100).toFixed(1)}%)`);

    console.log('\n🔧 Tools mentioned:');
    Object.entries(metrics.byTool)
      .sort(([,a], [,b]) => (b as any).count - (a as any).count)
      .slice(0, 5)
      .forEach(([tool, data]) => {
        const toolData = data as any;
        console.log(`  ${tool}: ${toolData.count} tweets (avg: ${toolData.avgSentiment.toFixed(2)})`);
      });

    console.log(`\n📁 Output files:`);
    console.log(`  ${tweetsOutputPath}`);
    console.log(`  ${metricsOutputPath}`);
    console.log(`  ${join(publicDataDir, 'x-posts-sentiment.json')}`);
    console.log(`  ${join(publicDataDir, 'sentiment-metrics.json')}`);

  } catch (error) {
    console.error('❌ Error during sentiment analysis:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { processTweets, generateMetrics };
