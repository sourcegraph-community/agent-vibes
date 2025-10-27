import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { DashboardRepository } from '@/src/ApifyPipeline/DataAccess/Repositories/DashboardRepository';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const productsParam = searchParams.get('products');
    const language = searchParams.get('language');

    // Validate days parameter
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Days must be between 1 and 365' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const repo = new DashboardRepository(supabase);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Parse products filter
    const products = productsParam
      ? decodeURIComponent(productsParam).split(',').map(p => p.trim()).filter(p => p)
      : undefined;

    const sentimentData = await repo.getProductDailySentiment({
      startDate: startDate.toISOString().split('T')[0],
      language: language || undefined,
      products: products && products.length > 0 ? products : undefined,
      limit: Math.min(days * 10 * (products?.length || 1), 10000),
    });

    // Group data by product and day
    const dataByProduct: Record<string, Array<{
      day: string;
      positive_count: number;
      negative_count: number;
      neutral_count: number;
      total_count: number;
      avg_sentiment_score: number;
    }>> = {};

    for (const row of sentimentData) {
      if (!dataByProduct[row.product]) {
        dataByProduct[row.product] = [];
      }
      dataByProduct[row.product].push({
        day: row.sentimentDay,
        positive_count: row.positiveCount,
        negative_count: row.negativeCount,
        neutral_count: row.neutralCount,
        total_count: row.totalCount,
        avg_sentiment_score: row.avgSentimentScore,
      });
    }

    // Compute summary totals across all selected products
    const totals = sentimentData.reduce(
      (acc, day) => ({
        totalTweets: acc.totalTweets + day.totalCount,
        positive: acc.positive + day.positiveCount,
        neutral: acc.neutral + day.neutralCount,
        negative: acc.negative + day.negativeCount,
      }),
      { totalTweets: 0, positive: 0, neutral: 0, negative: 0 },
    );

    const avgScore = sentimentData.length > 0
      ? sentimentData.reduce((sum, day) => sum + (day.avgSentimentScore || 0), 0) / sentimentData.length
      : 0;

    return NextResponse.json({
      dataByProduct,
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
    console.error('Error fetching product sentiment data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product sentiment data' },
      { status: 500 },
    );
  }
}
