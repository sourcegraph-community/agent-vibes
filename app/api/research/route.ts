import { NextRequest, NextResponse } from 'next/server';
import { searchAdsCodingAgents } from '@/lib/ads';
import type { PapersResponse, ResearchApiError, TimeWindow } from '@/types/research';

// Cache for 12 hours (43200 seconds)
export const revalidate = 43200;

// In-memory cache to avoid repeated API calls within the same deployment
const cache = new Map<string, { data: PapersResponse; timestamp: number }>();
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const crawl = searchParams.get('crawl') === 'true';
  const limit = parseInt(searchParams.get('limit') || '25');
  const window = (searchParams.get('window') || '3m') as TimeWindow;

  // Validate window parameter
  const validWindows: TimeWindow[] = ['3m', '1m', '1w', '3d', '1d', 'all'];
  if (!validWindows.includes(window)) {
    return NextResponse.json({
      error: 'Invalid window parameter',
      details: `Window must be one of: ${validWindows.join(', ')}`,
      code: 'INVALID_WINDOW',
    } as ResearchApiError, { status: 400 });
  }

  try {
    // Create cache key based on parameters
    const cacheKey = `${limit}-${window}`;

    // Check if we have fresh cached data (unless this is a crawl request)
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (!crawl && cached && (now - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Fetch fresh data from ADS
    const papers = await searchAdsCodingAgents({ rows: limit, window });

    const response: PapersResponse = {
      papers,
      total: papers.length,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    cache.set(cacheKey, { data: response, timestamp: now });

    // If this is a crawl request, we could trigger notifications here
    if (crawl) {
      await handleCrawlNotifications(papers);
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
        'X-Cache-Status': 'FRESH',
      },
    });

  } catch (error) {
    console.error('Research API error:', error);

    const errorResponse: ResearchApiError = {
      error: 'Failed to fetch research papers',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'ADS_API_ERROR',
    };

    // If we have cached data, return it with a warning
    const cacheKey = `${limit}-${window}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        warning: 'Using cached data due to API error',
      }, {
        status: 200,
        headers: {
          'X-Cache-Status': 'STALE',
          'X-Error': errorResponse.error,
        },
      });
    }

    return NextResponse.json(errorResponse, { status: 502 });
  }
}

/**
 * Handle notifications for new papers discovered during crawl
 */
async function handleCrawlNotifications(papers: any[]) {
  // For now, just log the count
  // In the future, this would integrate with Knock to send notifications
  // about new papers to subscribed users

  console.log(`Crawl completed: Found ${papers.length} papers`);

  // TODO: Implement database persistence and new paper detection
  // TODO: Trigger Knock notifications for new papers

  // Example of what this might look like:
  // const newPapers = await detectNewPapers(papers);
  // if (newPapers.length > 0) {
  //   await knockClient.workflows.trigger('new-research-papers', {
  //     recipients: ['dashboard-subscribers'],
  //     data: { count: newPapers.length, papers: newPapers.slice(0, 3) }
  //   });
  // }
}

/**
 * Health check endpoint
 */
export async function HEAD() {
  try {
    // Quick validation that we can access the ADS API
    if (!process.env.ADS_API_TOKEN) {
      return new NextResponse(null, { status: 503 });
    }
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
