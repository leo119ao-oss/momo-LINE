import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/lineClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, message } = body;

    if (!userId || !message) {
      return NextResponse.json({ error: 'userId and message are required' }, { status: 400 });
    }

    console.log(`[TEST] Sending test message to user ${userId}: ${message}`);

    // LINE APIを使ってメッセージを送信
    await lineClient.pushMessage(userId, {
      type: 'text',
      text: message
    });

    console.log(`[TEST] Message sent successfully to user ${userId}`);

    return NextResponse.json({ 
      success: true, 
      message: `Test message sent to user ${userId}` 
    });

  } catch (error) {
    console.error('[TEST] Error sending test message:', error);
    return NextResponse.json({ 
      error: 'Failed to send test message', 
      details: String(error) 
    }, { status: 500 });
  }
}
