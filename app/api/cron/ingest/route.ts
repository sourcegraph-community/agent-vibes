import { NextResponse } from 'next/server';
import { runAllIngestion } from '@/lib/ingest/runAll';

export async function GET() {
  try {
    console.log('⏰ Cron job triggered for ingestion');

    const stats = await runAllIngestion();

    // Notifications are now handled within runAllIngestion

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Cron ingestion failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST() {
  return GET();
}
