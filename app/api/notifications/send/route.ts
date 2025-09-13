import { NextRequest, NextResponse } from 'next/server';
import { Knock } from '@knocklabs/node';

const knock = new Knock(process.env.KNOCK_SECRET_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { userId, title, body } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Trigger a notification workflow
    await knock.workflows.trigger('agentvibes-launch', {
      recipients: [{ id: userId }],
      data: {
        title,
        body,
        url: process.env.NEXT_PUBLIC_APP_URL || 'https://agentvibes.com'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
