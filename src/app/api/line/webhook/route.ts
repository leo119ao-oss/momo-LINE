import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/lineClient';
import { handleTextMessage } from '@/lib/momoLogic';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  const channelSecret = process.env.LINE_CHANNEL_SECRET || 'ec3e1c92ae6154edd4b59c9c3cb4a62c';
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  if (signature !== hash) {
    console.error('Signature validation failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = JSON.parse(body).events;

  try {
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId!;
        const userMessage = event.message.text;

        const replyMessage = await handleTextMessage(userId, userMessage);

        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: replyMessage,
        });
      }
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}
