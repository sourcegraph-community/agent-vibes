import { NextResponse } from 'next/server';
import { subscribeUserToNotifications } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, preferences = {} } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required',
      }, { status: 400 });
    }

    await subscribeUserToNotifications(userId, preferences);

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to dashboard notifications',
      userId,
    });

  } catch (error) {
    console.error('Dashboard subscription failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Subscription failed',
    }, { status: 500 });
  }
}
