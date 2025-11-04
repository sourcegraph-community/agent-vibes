import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';
import { fetchEnabledKeywordsByProduct } from '@/src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository';
import { DashboardRepository } from '@/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository';

interface TweetDetail {
  id: string;
  authorHandle: string | null;
  authorName: string | null;
  postedAt: string;
  language: string | null;
  content: string;
  url: string | null;
  engagementLikes: number | null;
  engagementRetweets: number | null;
  keywords: string[];
  sentimentLabel: string | null;
  sentimentScore: number | null;
}

interface DayGroup {
  day: string; // YYYY-MM-DD
  count: number;
  tweets: TweetDetail[];
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const days = Number.parseInt(params.get('days') || '7', 10);
    const productsParam = params.get('products');
    const language = params.get('language') || undefined;
    // limitPerDay removed; UI controls visible items via scroll

    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 });
    }
    // per-day item count is a UI concern; server returns all tweets for the window

    // Use service role client to bypass RLS (matches collector pattern)
    const supabase = createSupabaseServiceClient();

    // Resolve brand → keywords (optional)
    let productKeywords: string[] | undefined;
    const products = productsParam
      ? productsParam
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
      : [];

    if (products.length > 0) {
      // For now, support a single selected brand (UI provides one); if multiple provided, merge their keywords
      const keywordLists = await Promise.all(
        products.map((product) =>
          fetchEnabledKeywordsByProduct(supabase, product),
        ),
      );
      const allKeywords = new Set<string>(keywordLists.flat().map((k) => k.toLowerCase()));
      productKeywords = Array.from(allKeywords);
      // Graceful fallback: if no keywords resolved for the selected brand, do not short-circuit.
      // Proceed without a keyword filter so the UI can still show recent posts.
      if (productKeywords.length === 0) {
        productKeywords = undefined;
      }
    }

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));
    const startIso = startDate.toISOString();

    const repo = new DashboardRepository(supabase);
    const hardCap = 2000;
    const windowLimit = Math.min(days * 200, hardCap);

    // Fetch tweets for the window (no DB keyword filter to avoid case/quote mismatches)
    const rows = await repo.getTweetsByPostedWindow({
      startDate: startIso,
      language: language || undefined,
      keywords: productKeywords,
      limit: windowLimit,
    });

    // If brand keywords were resolved, filter in-memory using case-insensitive match
    // No in-memory brand filter needed when DB-level filter applied.

    const toTweet = (row: { id: string; authorHandle: string | null; authorName: string | null; postedAt: string; language: string | null; content: string; url: string | null; engagementLikes: number | null; engagementRetweets: number | null; keywords: string[]; sentimentLabel: string | null; sentimentScore: number | null; }): TweetDetail & { dayKey: string } => {
      const daySource = row.postedAt;
      const dayKey = daySource.split('T')[0];
      return {
        id: row.id,
        authorHandle: row.authorHandle,
        authorName: row.authorName,
        postedAt: row.postedAt,
        language: row.language,
        content: row.content,
        url: row.url,
        engagementLikes: row.engagementLikes,
        engagementRetweets: row.engagementRetweets,
        keywords: row.keywords || [],
        sentimentLabel: row.sentimentLabel,
        sentimentScore: row.sentimentScore,
        dayKey,
      };
    };

    // Group by day
    const groups = new Map<string, Array<TweetDetail & { dayKey: string }>>();
    for (const row of rows) {
      const mapped = toTweet(row);
      if (!groups.has(mapped.dayKey)) groups.set(mapped.dayKey, []);
      groups.get(mapped.dayKey)!.push(mapped);
    }

    const sortedDays = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a)).slice(0, days);

    const dayGroups: DayGroup[] = sortedDays.map((day) => {
      const tweets = groups.get(day)!;
      return {
        day,
        count: tweets.length,
        tweets: tweets.map(({ dayKey, ...t }) => t),
      };
    });

    const total = rows.length;

    return NextResponse.json({
      days: dayGroups,
      summary: {
        days,
        total,
        product: products[0] || null,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching tweets by day:', error);
    return NextResponse.json({ error: 'Failed to fetch tweets by day' }, { status: 500 });
  }
}
