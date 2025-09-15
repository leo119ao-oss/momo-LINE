export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk'; // validateSignatureだけ残す
import { lineClient } from '@/lib/lineClient';      // lineClientはこちらから呼び出す
import { handleTextMessage } from '@/lib/momoLogic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { MessageEvent } from '@line/bot-sdk';

async function handleImage(event: MessageEvent){
  console.log('IMG_EVENT: Processing image message', event.message.id);
  const userId = event.source.userId!;
  
  try {
    // 画像取得
    const stream = await lineClient.getMessageContent(event.message.id);
    const chunks:any[] = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);

    // Supabase Storage に保存（公開URL）
    const path = `images/${userId}/${event.message.id}.jpg`;
    const { data:upload, error } = await supabaseAdmin.storage.from('media').upload(path, buf, { 
      contentType: 'image/jpeg', 
      upsert: true 
    });
    if(error) {
      console.error('Storage upload error:', error);
      throw error;
    }
    
    const { publicUrl } = supabaseAdmin.storage.from('media').getPublicUrl(path).data;
    console.log('IMG_EVENT: Image saved to', publicUrl);

    // 画像の基本説明を生成
    const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
    const guessSys = '写真を見て情景を1文で。断定しすぎず、やさしい文体。';
    const vision = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: guessSys },
        { role: 'user', content: [
            { type: 'text', text: 'この画像の情景。短い名詞句ではなく1文で。' },
            { type: 'image_url', image_url: { url: publicUrl } }
          ] as any }
      ],
      temperature: 0.6
    });
    const base = (vision.choices[0].message.content || '').trim();
    console.log('IMG_EVENT: Generated base description:', base);

    // キャプション候補を2-3個生成
    const caps = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '次の文から、日記のキャプション候補を日本語で3つ。15〜28字。言い切り or 〜だなあ調。絵文字や記号なし。' },
        { role: 'user', content: base }
      ],
      temperature: 0.7
    });
    const candidates = (caps.choices[0].message.content || '')
      .split(/\n+/).map(s => s.replace(/^\d+[\).、]\s*/, '')).filter(Boolean).slice(0,3);
    console.log('IMG_EVENT: Generated candidates:', candidates);

    // DBにpendingとして保存
    const { data: part } = await supabaseAdmin.from('participants').select('id').eq('line_user_id', userId).single();
    await supabaseAdmin.from('media_entries').insert({
      participant_id: part!.id, 
      image_url: publicUrl, 
      guess: base,
      suggested_caption: JSON.stringify(candidates),
      ask_stage: 1,
      status: 'awaiting'
    });
    console.log('IMG_EVENT: Saved to media_entries with candidates');

    // LINE返信（番号選択を促す）
    const responseText = `素敵な1枚だね。これは「${base}」って感じかな？\n\nキャプション案：\n1) ${candidates[0]}\n2) ${candidates[1] || ''}\n3) ${candidates[2] || ''}\n\n近い番号を教えてね。ぜんぶ違えば、理想の文をそのまま送ってくれて大丈夫！`;
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: responseText
    });
    console.log('IMG_EVENT: Sent response with candidates');
    
  } catch (error) {
    console.error('IMG_EVENT: Error processing image:', error);
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像の処理でエラーが発生しました。もう一度お試しください。'
    });
  }
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
