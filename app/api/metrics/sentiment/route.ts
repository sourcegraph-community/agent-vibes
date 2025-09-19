import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import Sentiment from 'sentiment';
import type { SentimentMetrics, SentimentApiParams, ProcessedTweet, ToolSentimentComparison } from '@/types/sentiment';

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Using Node.js runtime for file system access
export const runtime = 'nodejs';

// Cache for 30 minutes
const CACHE_CONTROL = 'public, max-age=1800, s-maxage=1800';

// Raw tweet interface from the JSON file
interface RawTweet {
  id: string;
  text: string;
  fullText: string;
  createdAt: string;
  author: {
    userName: string;
    name: string;
  };
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  url: string;
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

function calculateEngagementScore(tweet: RawTweet): number {
  // Weight different engagement types
  const likes = tweet.likeCount || 0;
  const retweets = (tweet.retweetCount || 0) * 3; // Retweets are more valuable
  const replies = (tweet.replyCount || 0) * 2;   // Replies show engagement
  const views = (tweet.viewCount || 0) * 0.01;   // Views are less valuable

  return likes + retweets + replies + views;
}

function processRawTweet(rawTweet: RawTweet): ProcessedTweet {
  const cleanedText = cleanText(rawTweet.fullText);
  const sentimentResult = sentiment.analyze(cleanedText);
  const tool = detectTool(rawTweet.fullText);
  const engagementScore = calculateEngagementScore(rawTweet);

  return {
    ...rawTweet,
    sentiment: sentimentResult.score,
    tool,
    cleanText: cleanedText,
    engagementScore,
  };
}

function getRawTweetsData(): RawTweet[] {
  try {
    const dataPath = join(process.cwd(), 'data', '2025-09-17-apify-x-posts-100.json');
    const data = readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading raw tweets:', error);
    return [];
  }
}

function getProcessedTweets(): ProcessedTweet[] {
  const rawTweets = getRawTweetsData();
  return rawTweets.map(processRawTweet);
}

function generateMetrics(processedTweets: ProcessedTweet[]): SentimentMetrics {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const metrics = {
    total: processedTweets.length,
    lastUpdated: now.toISOString(),

    // Overall sentiment
    overall: {
      avgSentiment: processedTweets.length > 0 ? processedTweets.reduce((sum, t) => sum + t.sentiment, 0) / processedTweets.length : 0,
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



function filterTweetsByWindow(tweets: ProcessedTweet[], window: string): ProcessedTweet[] {
  if (window === 'all') return tweets;

  const now = new Date();
  let cutoffMs: number;

  switch (window) {
    case '24h':
      cutoffMs = 24 * 60 * 60 * 1000;
      break;
    case '7d':
      cutoffMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      cutoffMs = 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      cutoffMs = 7 * 24 * 60 * 60 * 1000; // default to 7 days
  }

  const cutoff = new Date(now.getTime() - cutoffMs);
  return tweets.filter(tweet => new Date(tweet.createdAt) > cutoff);
}

function calculateTrendData(tweets: ProcessedTweet[], window: string) {
  const filteredTweets = filterTweetsByWindow(tweets, window);

  // Group by day
  const dailyData: Record<string, ProcessedTweet[]> = {};
  filteredTweets.forEach(tweet => {
    const date = new Date(tweet.createdAt).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = [];
    }
    dailyData[date].push(tweet);
  });

  // Convert to trend points
  return Object.entries(dailyData)
    .map(([date, dayTweets]) => ({
      date,
      count: dayTweets.length,
      avgSentiment: dayTweets.reduce((sum, t) => sum + t.sentiment, 0) / dayTweets.length,
      positive: dayTweets.filter(t => t.sentiment > 0).length,
      negative: dayTweets.filter(t => t.sentiment < 0).length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculateToolComparison(tweets: ProcessedTweet[], window: string): ToolSentimentComparison[] {
  const filteredTweets = filterTweetsByWindow(tweets, window);

  // Group by tool
  const toolData: Record<string, ProcessedTweet[]> = {};
  filteredTweets.forEach(tweet => {
    if (!toolData[tweet.tool]) {
      toolData[tweet.tool] = [];
    }
    toolData[tweet.tool].push(tweet);
  });

  // Calculate metrics for each tool
  return Object.entries(toolData)
    .map(([tool, toolTweets]) => ({
      tool,
      count: toolTweets.length,
      avgSentiment: toolTweets.reduce((sum, t) => sum + t.sentiment, 0) / toolTweets.length,
      positive: toolTweets.filter(t => t.sentiment > 0).length,
      negative: toolTweets.filter(t => t.sentiment < 0).length,
      totalEngagement: toolTweets.reduce((sum, t) => sum + t.engagementScore, 0),
    }))
    .sort((a, b) => b.count - a.count); // Sort by tweet volume
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: SentimentApiParams = {
      tool: searchParams.get('tool') || undefined,
      window: (searchParams.get('window') as any) || '7d',
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    // Process raw tweets automatically
    const tweets = getProcessedTweets();
    const metrics = generateMetrics(tweets);

    // Apply filters
    let filteredTweets = tweets;

    if (params.tool && params.tool !== 'all') {
      filteredTweets = filteredTweets.filter(tweet =>
        tweet.tool.toLowerCase() === params.tool!.toLowerCase(),
      );
    }

    filteredTweets = filterTweetsByWindow(filteredTweets, params.window || '7d');

    // Calculate dynamic metrics
    const totalFiltered = filteredTweets.length;
    const avgSentiment = totalFiltered > 0
      ? filteredTweets.reduce((sum, t) => sum + t.sentiment, 0) / totalFiltered
      : 0;

    const positive = filteredTweets.filter(t => t.sentiment > 0).length;
    const negative = filteredTweets.filter(t => t.sentiment < 0).length;
    const neutral = totalFiltered - positive - negative;

    // Build response
    const response = {
      total: totalFiltered,
      window: params.window,
      tool: params.tool,
      lastUpdated: metrics.lastUpdated,

      summary: {
        avgSentiment,
        positive,
        neutral,
        negative,
        positiveRate: totalFiltered > 0 ? (positive / totalFiltered) * 100 : 0,
        negativeRate: totalFiltered > 0 ? (negative / totalFiltered) * 100 : 0,
      },

      // Include trend data for charts
      trend: calculateTrendData(tweets, params.window || '7d'),

      // Tool comparison
      toolComparison: calculateToolComparison(tweets, params.window || '7d'),

      // Recent tweets (for the feed)
      recentTweets: filteredTweets
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(params.offset || 0, (params.offset || 0) + (params.limit || 25))
        .map(tweet => ({
          id: tweet.id,
          text: tweet.fullText,
          sentiment: tweet.sentiment,
          tool: tweet.tool,
          createdAt: tweet.createdAt,
          author: tweet.author,
          url: tweet.url,
          engagement: {
            likes: tweet.likeCount,
            retweets: tweet.retweetCount,
            replies: tweet.replyCount,
            views: tweet.viewCount,
            score: tweet.engagementScore,
          },
        })),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': CACHE_CONTROL,
      },
    });

  } catch (error) {
    console.error('Error in sentiment API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment data' },
      { status: 500 },
    );
  }
}
