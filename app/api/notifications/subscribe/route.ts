import { NextRequest, NextResponse } from 'next/server';
import { Knock } from '@knocklabs/node';

export async function POST(request: NextRequest) {
  try {
    const { subscription, userId } = await request.json();

    if (!subscription || !userId) {
      return NextResponse.json(
        { error: 'Missing subscription or userId' },
        { status: 400 },
      );
    }

    // Check if Knock API key is available
    if (!process.env.KNOCK_SECRET_API_KEY) {
      console.log('Knock API key not configured, skipping notification setup');
      return NextResponse.json({ success: true, message: 'Notifications not configured' });
    }

    // Initialize Knock only when needed and API key is available
    const knock = new Knock(process.env.KNOCK_SECRET_API_KEY);

    // Set up the user in Knock with the web push subscription
    await knock.users.identify(userId, {
      name: 'AgentVibes User',
      email: `user-${userId}@agentvibes.com`, // Placeholder email
    });

    // Set the push subscription for the user
    await knock.users.setChannelData(userId, 'web-push', {
      tokens: [subscription],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 },
    );
  }
}
