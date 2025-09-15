export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk'; // validateSignatureだけ残す
import { lineClient } from '@/lib/lineClient';      // lineClientはこちらから呼び出す
import { handleTextMessage } from '@/lib/momoLogic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { MessageEvent } from '@line/bot-sdk';

async function handleImage(event: MessageEvent){
  const userId = event.source.userId!;
  // 画像取得
  const stream = await lineClient.getMessageContent(event.message.id);
  const chunks:any[] = [];
  for await (const c of stream) chunks.push(c);
  const buf = Buffer.concat(chunks);

  // Supabase Storage に保存（公開URL）
  const path = `images/${userId}/${event.message.id}.jpg`;
  const { data:upload, error } = await supabaseAdmin.storage.from('media').upload(path, buf, { upsert: true, contentType: 'image/jpeg' });
  if(error) throw error;
  const { data: pub } = supabaseAdmin.storage.from('media').getPublicUrl(path);
  const imageUrl = pub.publicUrl;

  // 軽い画像説明（4o-mini vision）
  const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
  const sys = 'あなたは写真をやさしく説明する編集者。1文で「〜っぽいね」のトーン。';
  const visMsg:any = [
    { role:'system', content: sys },
    { role:'user', content: [
        { type:'text', text:'この画像は何に見える？1文で' },
        { type:'image_url', image_url:{ url: imageUrl } }
    ]}
  ];
  const g = await openai.chat.completions.create({ model:'gpt-4o-mini', messages: visMsg, temperature:0.2 });
  const guess = g.choices[0].message.content?.trim() || '日常の一コマかな？';

  // DBにpendingとして保存
  const { data: part } = await supabaseAdmin.from('participants').select('id').eq('line_user_id', userId).single();
  await supabaseAdmin.from('media_entries').insert({
    participant_id: part!.id, image_url: imageUrl, guess, status:'awaiting'
  });

  // ユーザーへ確認質問
  await lineClient.replyMessage(event.replyToken, {
    type:'text',
    text: `${guess}\nあってる？ ひとこと教えてくれたら、絵日記のキャプションに仕立てるね。`
  });
}

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
      if (event.type === 'message' && event.message.type === 'image') {
        await handleImage(event as any);
        continue;
      }
      
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId!;
        const userMessage = event.message.text;

        console.log(`Processing message from user ${userId}: ${userMessage.substring(0, 50)}...`);

        try {
          // 未回答の画像があればキャプション確定
          const { data: part } = await supabaseAdmin.from('participants').select('id').eq('line_user_id', userId).single();
          const { data: pending } = await supabaseAdmin
            .from('media_entries')
            .select('*').eq('participant_id', part!.id).eq('status','awaiting')
            .order('created_at',{ascending:false}).limit(1);

          if(pending && pending.length){
            const m = pending[0];
            const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
            const sys = 'あなたは写真日記の編集者。ユーザーの一言を活かし、やさしい1文キャプションを作る。';
            const prompt = `画像メモ: ${m.guess}\nユーザーの追記: ${userMessage}\n→ 30〜60字の一文キャプションで。`;
            const c = await openai.chat.completions.create({ model:'gpt-4o-mini', messages:[{role:'system',content:sys},{role:'user',content:prompt}], temperature:0.3 });
            const caption = c.choices[0].message.content?.trim() || userMessage.trim();
            await supabaseAdmin.from('media_entries').update({ user_answer: userMessage, caption, status:'done' }).eq('id', m.id);
            await lineClient.replyMessage(event.replyToken, {
              type:'text',
              text: `できたよ。\n「${caption}」\n（このあと一覧ページも作れるようにするね）\n${m.image_url}`
            });
            continue;
          }

          const replyMessage = await handleTextMessage(userId, userMessage);

          // replyは一度きり。失敗時はpushしないでログのみ（ダブり防止）
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
