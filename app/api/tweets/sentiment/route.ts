import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ProcessedTweet } from '@/types/sentiment';

// Using Node.js runtime for file system access
export const runtime = 'nodejs';

const CACHE_CONTROL = 'public, max-age=1800, s-maxage=1800';

function getTweetsData(): ProcessedTweet[] {
  try {
    // Try cache first, fallback to public
    const cachePath = join(process.cwd(), '.next', 'cache', 'x-posts-sentiment.json');
    try {
      const data = readFileSync(cachePath, 'utf8');
      return JSON.parse(data);
    } catch {
      const publicPath = join(process.cwd(), 'public', 'data', 'x-posts-sentiment.json');
      const data = readFileSync(publicPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading tweets:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tool = searchParams.get('tool');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = parseInt(searchParams.get('offset') || '0');
    const minSentiment = searchParams.get('minSentiment') ? parseFloat(searchParams.get('minSentiment')!) : undefined;
    const maxSentiment = searchParams.get('maxSentiment') ? parseFloat(searchParams.get('maxSentiment')!) : undefined;

    let tweets = getTweetsData();

    // Apply filters
    if (tool && tool !== 'all') {
      tweets = tweets.filter(tweet => tweet.tool.toLowerCase() === tool.toLowerCase());
    }

    if (minSentiment !== undefined) {
      tweets = tweets.filter(tweet => tweet.sentiment >= minSentiment);
    }

    if (maxSentiment !== undefined) {
      tweets = tweets.filter(tweet => tweet.sentiment <= maxSentiment);
    }

    // Sort by date (newest first)
    tweets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const total = tweets.length;
    const paginatedTweets = tweets.slice(offset, offset + limit);

    // Format response
    const formattedTweets = paginatedTweets.map(tweet => ({
      id: tweet.id,
      text: tweet.fullText,
      cleanText: tweet.cleanText,
      sentiment: tweet.sentiment,
      tool: tweet.tool,
      createdAt: tweet.createdAt,
      author: {
        userName: tweet.author.userName,
        name: tweet.author.name,
      },
      url: tweet.url,
      engagement: {
        likes: tweet.likeCount || 0,
        retweets: tweet.retweetCount || 0,
        replies: tweet.replyCount || 0,
        views: tweet.viewCount || 0,
        score: tweet.engagementScore,
      },
      // Add sentiment categorization for UI
      sentimentCategory: tweet.sentiment > 0 ? 'positive' : tweet.sentiment < 0 ? 'negative' : 'neutral',
      sentimentColor: tweet.sentiment > 2 ? 'green' : tweet.sentiment > 0 ? 'blue' : tweet.sentiment < -1 ? 'red' : 'gray',
    }));

    return NextResponse.json({
      tweets: formattedTweets,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        nextOffset: offset + limit < total ? offset + limit : null,
      },
      filters: {
        tool,
        minSentiment,
        maxSentiment,
      },
    }, {
      headers: {
        'Cache-Control': CACHE_CONTROL,
      },
    });

  } catch (error) {
    console.error('Error in tweets sentiment API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tweets' },
      { status: 500 },
    );
  }
}
