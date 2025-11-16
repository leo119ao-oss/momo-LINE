export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import { lineClient } from '@/lib/lineClient';
import { handleTextMessage } from '@/lib/momoLogic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { MessageEvent } from '@line/bot-sdk';
import { findOrCreateParticipant } from '@/lib/participants';
import { getOrStartSession, endSession } from '@/lib/session';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// 本番URLを取得するヘルパー関数
function getProductionUrl(): string {
  // NEXT_PUBLIC_APP_URLが設定されている場合はそれを優先（本番環境用）
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // 本番環境の場合のみVERCEL_URLを使用（プレビューURLは使用しない）
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // 開発環境
  return process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
}

async function handleImage(event: MessageEvent){
  console.log('IMG_EVENT: Processing image message', event.message.id);
  const userId = event.source.userId!;

  try {
    // 画像取得
    const stream = await lineClient.getMessageContent(event.message.id);
    const chunks:any[] = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);

    // Supabase Storage に保存（ 公開URL）
    const path = `images/${userId}/${event.message.id}.jpg`;
    const { error } = await supabaseAdmin.storage.from('media').upload(path, buf, {
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
    const guessSys = '写真を見て 情景を1文で。断定しすぎず、やさしい文体。';
    const vision = await openai.chat.completions.create({
      model: 'gpt-5.1-mini',
      messages: [
        { role: 'system', content: guessSys },
        { role: 'user', content: [
            { type: 'text', text: 'この画像の情景。短い名詞句では なく1文で。' },
            { type: 'image_url', image_url: { url: publicUrl } }
          ] as any }
      ],
      temperature: 0.6
    });
    const base = (vision.choices[0].message.content || '').trim();
    console.log('IMG_EVENT: Generated base description:', base);

    // キャプション候補を2-3個生成
    const caps = await openai.chat.completions.create({
      model: 'gpt-5.1-mini',
      messages: [
        { role: 'system', content: '次の説明から、日記のキャプション候補を日本語で3つ、15-18字。言い切りめor 〜だなあ調。絵文字や記号なし。' },
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

async function replyWithLoginLink(replyToken: string, userId: string, options: { isLoginRequest: boolean }) {
  const baseUrl = getProductionUrl();

  try {
    const tokenRes = await fetch(`${baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });

    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      if (tokenData.ok && tokenData.token) {
        const loginUrl = `${baseUrl}/action?token=${tokenData.token}`;
        const message = options.isLoginRequest
          ? `記事コーチモードにアクセスするためのリンクです。

以下のURLをクリックしてください：
${loginUrl}

※このリンクは10分間有効です。
※スマホでもPCでもアクセスできます。`
          : `研究協力のための記事作成サポートを開始できます！

以下のリンクから記事コーチモードにアクセスしてください：
${loginUrl}

※このリンクは10分間有効です。
※スマホでもPCでもアクセスできます。`;

        await lineClient.replyMessage(replyToken, {
          type: 'text' as const,
          text: message,
        } as any);
        return;
      }
    }
  } catch (err) {
    console.error('[WEBHOOK] Token generation error:', err);
  }

  // トークン生成に失敗した場合のフォールバック
  const fallbackUrl = `${baseUrl}/action?user_id=${userId}`;
  const fallbackMessage = options.isLoginRequest
    ? `記事コーチモードにアクセスするためのリンクです。

以下のURLをクリックしてください：
${fallbackUrl}

※こちらは通常のログイン用URLです。`
    : `研究協力のための記事作成サポートを開始できます！

以下のリンクから記事コーチモードにアクセスしてください：
${fallbackUrl}`;

  await lineClient.replyMessage(replyToken, {
    type: 'text' as const,
    text: fallbackMessage,
  } as any);
}

export async function POST(req: NextRequest) {
  console.log('[WEBHOOK] Request received');

  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  console.log('[WEBHOOK] Body length:', body.length);
  console.log('[WEBHOOK] Signature present:', !!signature);

  if (!validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature)) {
    console.error('[WEBHOOK] Signature validation failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = JSON.parse(body).events;
  console.log(`[WEBHOOK] Received ${events.length} webhook events`);

  try {
    for (const event of events) {
      try {
        if (event.type !== 'message' && event.type !== 'postback') continue;

        const userId = event.source?.userId;
        if (!userId) continue;

        const participant = await findOrCreateParticipant(userId);
        const { session, isNew } = await getOrStartSession(participant.id);

        console.log(`[WEBHOOK] Session state: isNew=${isNew}, sessionId=${session?.id}`);

        const textMessage =
          event.type === 'message' && event.message?.type === 'text'
            ? (event.message.text ?? '').trim()
            : '';
        const loginKeywords = ['ログイン', '認証', 'login'];
        const articleKeywords = ['記事を書く', '記事', 'コーチ', '日記', '記事コーチ'];
        const isLoginRequest = textMessage
          ? loginKeywords.some((keyword) => textMessage.toLowerCase().includes(keyword.toLowerCase()))
          : false;
        const isArticleRequest = textMessage
          ? articleKeywords.some((keyword) => textMessage.includes(keyword))
          : false;

        // 画像処理（最優先）
        if (event.type === 'message' && event.message.type === 'image') {
          await handleImage(event as any);
          continue;
        }

        // 新規セッション開始時はLIFFアプリの案内
        if (isNew) {
          if (textMessage && (isLoginRequest || isArticleRequest) && event.replyToken) {
            await replyWithLoginLink(event.replyToken, userId, { isLoginRequest });
            continue;
          }

          console.log('[WEBHOOK] Starting new session, showing LIFF app introduction');
          await lineClient.replyMessage(event.replyToken, {
            type: 'text' as const,
            text: (() => {
              const baseUrl = getProductionUrl();
              const actionUrl = `${baseUrl}/action?user_id=${userId}`;
              
              return `こんにちは！Momoです。

LIFFアプリで何ができるか知りたいですか？

「使い方を教えて」「今日の1分って何？」「今日の気持ちって何？」など、気軽に質問してください。

また、天気やニュース、レシピなど、ネット検索が必要な質問にもお答えできます。

━━━━━━━━━━━━━━━━
📝 研究協力のお願い
━━━━━━━━━━━━━━━━

研究協力のための日記（記事）作成をサポートしています！

期間：11/8–11/24（延長）
以下のURLから記事コーチモードにアクセスできます：
${actionUrl}

テーマ選びからアウトライン作成、本文執筆までサポートします。300-500字を目安に、無理なく書き上げられます。

日記を書いた後は、「ペンを持つ効果アンケート」にもご協力いただけると嬉しいです。リッチメニューの「アンケート」ボタンからアクセスできます。`;
            })()
          } as any);
          continue;
        }

        console.log('[WEBHOOK] Existing session, checking for text messages or postbacks');

        // POSTBACK（簡素化）
        if (event.type === 'postback') {
          const data: string = event.postback?.data || '';
          
          // セッション終了
          if (data === 'session:end') {
            await endSession(session.id);
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: 'ここで一区切りにするね。おつかれさま。'
            } as any);
            continue;
          }
          
          // セッション継続
          if (data === 'session:cont') {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: 'LIFFアプリについて何か質問があれば、気軽に聞いてください。'
            } as any);
            continue;
          }
        }

        // MESSAGE（text/image 等）。textは自由入力扱い
        if (event.type === 'message' && event.message?.type === 'text') {
          const text: string = textMessage;

          console.log(`[WEBHOOK] Text message received: "${text}"`);

          // LIFFアプリQ&Aシステムを使用
          try {
            if (isLoginRequest || isArticleRequest) {
              await replyWithLoginLink(event.replyToken, userId, { isLoginRequest });
              continue;
            }

            const aiMessage = await handleTextMessage(userId, text);
            
            // LIFFアプリQ&Aの応答を送信
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: aiMessage
            } as any);
            
            continue;
          } catch (textError) {
            console.error('[WEBHOOK] Error processing text message:', textError);
            
            // エラー時の応答
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: 'すみません、LIFFアプリの機能について詳しく説明できませんでした。もう一度お聞かせください。'
            } as any);
            continue;
          }
        }

        // 他タイプ（スタンプ等）はミニ応答のみ
        await lineClient.replyMessage(event.replyToken, { type: 'text', text: 'LIFFアプリについて何か質問があれば、気軽に聞いてください。天気やニュース、レシピなど、ネット検索が必要な質問にもお答えできます。' } as any);

      } catch (e) {
        console.error('[WEBHOOK_ERROR]', e);
        try {
          // エラーメッセージは1回だけ送信
          if (event.replyToken) {
            await lineClient.replyMessage(event.replyToken, { type: 'text', text: 'すみません、少し調子が悪いみたい。もう一度試してみてください。' } as any);
          }
        } catch (replyError) {
          console.error('[REPLY_ERROR]', replyError);
          // リプライエラーは無視（重複送信を防ぐ）
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}