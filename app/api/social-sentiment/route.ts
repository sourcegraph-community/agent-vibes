import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { DashboardRepository } from '@/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    // Validate days parameter
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Days must be between 1 and 365' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const repo = new DashboardRepository(supabase);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sentimentData = await repo.getDailySentiment({
      startDate: startDate.toISOString().split('T')[0],
      limit: days * 10, // Allow for multiple languages per day
    });

    // Aggregate totals for the period
    const totals = sentimentData.reduce(
      (acc, day) => ({
        totalTweets: acc.totalTweets + day.totalCount,
        positive: acc.positive + day.positiveCount,
        neutral: acc.neutral + day.neutralCount,
        negative: acc.negative + day.negativeCount,
      }),
      { totalTweets: 0, positive: 0, neutral: 0, negative: 0 }
    );

    const avgScore = sentimentData.length > 0
      ? sentimentData.reduce((sum, day) => sum + (day.avgSentimentScore || 0), 0) / sentimentData.length
      : 0;

    return NextResponse.json({
      data: sentimentData,
      summary: {
        periodDays: days,
        totalTweets: totals.totalTweets,
        positiveCount: totals.positive,
        neutralCount: totals.neutral,
        negativeCount: totals.negative,
        avgSentimentScore: avgScore,
        positivePercentage: totals.totalTweets > 0 ? (totals.positive / totals.totalTweets) * 100 : 0,
        neutralPercentage: totals.totalTweets > 0 ? (totals.neutral / totals.totalTweets) * 100 : 0,
        negativePercentage: totals.totalTweets > 0 ? (totals.negative / totals.totalTweets) * 100 : 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching social sentiment data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social sentiment data' },
      { status: 500 }
    );
  }
}
