import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk'; // validateSignatureだけ残す
import { lineClient } from '@/lib/lineClient';      // lineClientはこちらから呼び出す
import { handleTextMessage } from '@/lib/momoLogic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (!validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature)) {
    console.error('Signature validation failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = JSON.parse(body).events;
  console.log(`Received ${events.length} webhook events`);

  try {
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId!;
        const userMessage = event.message.text;

        console.log(`Processing message from user ${userId}: ${userMessage.substring(0, 50)}...`);

        try {
          const replyMessage = await handleTextMessage(userId, userMessage);

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: replyMessage,
          });

          console.log(`Successfully replied to user ${userId}`);
        } catch (messageError) {
          console.error(`Error handling message from user ${userId}:`, messageError);
          
          // エラーが発生した場合でも、ユーザーにはエラーメッセージを送信
          try {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: 'すみません、一時的にエラーが発生しました。しばらく時間をおいてから、もう一度お試しください。',
            });
          } catch (replyError) {
            console.error('Failed to send error message:', replyError);
          }
        }
      } else if (event.type === 'follow') {
        // 友達追加時の処理
        const userId = event.source.userId!;
        console.log(`New user followed: ${userId}`);
        
        try {
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Momo AIパートナーへようこそ！\n\nあなたの内省を支援する、温かいパートナーとして、いつでもお話をお聞かせください。\n\n毎朝9時に小さな問いをお送りし、週末には一週間の振り返りをお届けします。',
          });
        } catch (error) {
          console.error('Error sending welcome message:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}
