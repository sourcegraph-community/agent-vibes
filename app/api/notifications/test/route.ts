import { NextResponse } from 'next/server';
import { sendTestNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId || 'dashboard-subscribers';

    const stats = await sendTestNotification(userId);

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
      stats,
    });

  } catch (error) {
    console.error('Test notification failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
