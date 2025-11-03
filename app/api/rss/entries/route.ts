import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { RssRepository } from '@/src/RssPipeline/DataAccess/Repositories/RssRepository';
import type { RssCategory } from '@/src/RssPipeline/Core/Models/RssEntry';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryParam = searchParams.get('category') || 'all';
    const category: RssCategory | undefined = categoryParam === 'all' ? undefined : categoryParam as RssCategory;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be >= 1' },
        { status: 400 },
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const repo = new RssRepository(supabase);

    const offset = (page - 1) * limit;

    const entries = await repo.getEntriesByCategory({
      category,
      limit,
      offset,
    });

    const totalCount = await repo.countEntriesByCategory({
      category,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: entries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching RSS entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS entries' },
      { status: 500 },
    );
  }
}
