import { NextRequest, NextResponse } from 'next/server';
import { handleGetOverviewMetrics } from './GetOverviewMetricsQueryHandler';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysRaw = searchParams.get('days');
    const days = Number.isFinite(Number(daysRaw)) ? Math.trunc(Number(daysRaw)) : 7;

    if (days < 1 || days > 365) {
      return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 });
    }

    const result = await handleGetOverviewMetrics({ days });

    const res = NextResponse.json(result);
    res.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
    return res;
  } catch (err) {
    console.error('Overview metrics error:', err);
    return NextResponse.json({ error: 'Failed to compute overview metrics' }, { status: 500 });
  }
}
