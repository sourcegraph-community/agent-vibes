import { NextRequest, NextResponse } from 'next/server';
import { searchAdsCodingAgents } from '@/lib/ads';
import type { PapersResponse, ResearchApiError } from '@/types/research';

// Cache for 12 hours (43200 seconds)
export const revalidate = 43200;

// In-memory cache to avoid repeated API calls within the same deployment
let cachedData: PapersResponse | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const crawl = searchParams.get('crawl') === 'true';
  const limit = parseInt(searchParams.get('limit') || '25');

  try {
    // Check if we have fresh cached data (unless this is a crawl request)
    const now = Date.now();
    if (!crawl && cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedData);
    }

    // Fetch fresh data from ADS
    const papers = await searchAdsCodingAgents(limit);
    
    const response: PapersResponse = {
      papers,
      total: papers.length,
      lastUpdated: new Date().toISOString()
    };

    // Update cache
    cachedData = response;
    cacheTimestamp = now;

    // If this is a crawl request, we could trigger notifications here
    if (crawl) {
      await handleCrawlNotifications(papers);
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
        'X-Cache-Status': 'FRESH'
      }
    });

  } catch (error) {
    console.error('Research API error:', error);
    
    const errorResponse: ResearchApiError = {
      error: 'Failed to fetch research papers',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'ADS_API_ERROR'
    };

    // If we have cached data, return it with a warning
    if (cachedData) {
      return NextResponse.json({
        ...cachedData,
        warning: 'Using cached data due to API error'
      }, {
        status: 200,
        headers: {
          'X-Cache-Status': 'STALE',
          'X-Error': errorResponse.error
        }
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
