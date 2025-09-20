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
import { EMOTION_CHOICES, DEEPENING_BY_EMOTION } from '@/config/conversationMap';
import { shouldAddInsightCue } from '@/lib/style/insightCue';
import { generateReflectiveCore } from '@/lib/reflectiveCore';
import { INSIGHT_CUE_SYSTEM, INSIGHT_CUE_USER } from '@/lib/prompts.insight';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function qr(items: { label: string, text?: string, data?: string }[]) {
  return {
    quickReply: {
      items: items.map(i => ({
        type: "action",
        action: i.text ? { type: "message", label: i.label, text: i.text }
                       : { type: "postback", label: i.label, data: i.data! }
      }))
    }
  };
}

function emotionQuickReply() {
  return qr(EMOTION_CHOICES.map(e => ({ label: e.label, data: `emotion:${e.key}` })));
}

function deepeningQuickReply(emotionKey: string) {
  const m = DEEPENING_BY_EMOTION[emotionKey] ?? { a: "A", b: "B" };
  return qr([
    { label: m.a, data: `deep:${emotionKey}:${m.a}` },
    { label: m.b, data: `deep:${emotionKey}:${m.b}` },
    { label: "ほかにもある", text: "自由入力します" }
  ]);
}

function endOrDiaryQR() {
  return qr([
    { label: "今日の1分に残す", data: "diary:save" },
    { label: "ここで終わる", data: "session:end" }
  ]);
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
      model: 'gpt-4o-mini',
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

        // 画像処理（最優先）
        if (event.type === 'message' && event.message.type === 'image') {
          await handleImage(event as any);
          continue;
        }

        // 新規セッション開始時は感情アイコンだけ出す
        if (isNew) {
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: 'こんにちは！いまの気分に近いものを選んでみてください。タップするだけでOKです。',
            ...emotionQuickReply()
          } as any);
          continue;
        }

        // POSTBACK（emotion/deep/diary/session）
        if (event.type === 'postback') {
          const data: string = event.postback?.data || '';
          if (data.startsWith('emotion:')) {
            const emotionKey = data.split(':')[1];
            const emotionLabels = {
              'smile': '😊 うれしい',
              'neutral': '😐 ふつう',
              'tired': '😩 つかれた',
              'anger': '😡 いらいら',
              'sad': '😢 かなしい',
              'think': '🤔 かんがえる'
            };
            const selectedEmotion = emotionLabels[emotionKey as keyof typeof emotionLabels] || emotionKey;
            
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: `${selectedEmotion}を選んだんだね。もう少し詳しく教えてもらえる？どちらが近いかな？`,
              ...deepeningQuickReply(emotionKey)
            } as any);
            continue;
          }
          if (data.startsWith('deep:')) {
            const [, emotionKey, choice] = data.split(':');
            const userText = `${emotionKey}:${choice}`;
            
            // 選択内容の確認メッセージを送信
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: `「${choice}」について聞かせてくれてありがとう。`
            } as any);
            
            // 傾聴応答を生成
            const base = await generateReflectiveCore(userText);

            const gate = shouldAddInsightCue(userText, {
              hasEmotionSelected: true,
              hasDeepeningChoice: true,
              emotion: emotionKey
            });

            let insight = '';
            if (gate.ok) {
              const comp = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                temperature: 0.3,
                messages: [
                  { role: 'system', content: INSIGHT_CUE_SYSTEM },
                  { role: 'user', content: INSIGHT_CUE_USER(userText) }
                ],
                timeout: (Number(process.env.GEN_TIMEOUT_SECONDS ?? 8) * 1000)
              } as any);
              insight = comp.choices?.[0]?.message?.content?.trim() ?? '';
            }

            // 傾聴応答を別のメッセージとして送信
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: [base, insight].filter(Boolean).join('\n'),
              ...endOrDiaryQR()
            } as any);
            continue;
          }
          if (data === 'diary:save') {
            // 最後の整理をそのまま保存する簡易版（詳細は /api/diary/create に出す場合はここでフェッチ）
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: '今日の1分にメモしたよ。ここで終わる？それとも続ける？',
              ...qr([{ label: "つづける", data: "session:cont" }, { label: "ここで終わる", data: "session:end" }])
            } as any);
            continue;
          }
          if (data === 'session:end') {
            await endSession(session.id);
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: 'ここで一区切りにするね。おつかれさま。'
            } as any);
            continue;
          }
          if (data === 'session:cont') {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text',
              text: 'OK。続けよう。',
              ...emotionQuickReply()
            } as any);
            continue;
          }
        }

        // MESSAGE（text/image 等）。textは自由入力扱い
        if (event.type === 'message' && event.message?.type === 'text') {
          const text: string = event.message.text?.trim() ?? '';

          // 最初の1往復は受け止め優先（強い追加はしない）
          const base = await generateReflectiveCore(text);

          const gate = shouldAddInsightCue(text, {
            hasEmotionSelected: false,
            hasDeepeningChoice: false
          });

          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: base + (!gate.ok ? '' : ''), // 自由入力では原則インサイト句は抑制
            ...endOrDiaryQR()
          } as any);
          continue;
        }

        // 他タイプ（スタンプ等）はミニ応答のみ
        await lineClient.replyMessage(event.replyToken, { type: 'text', text: '受け取ったよ。' } as any);

      } catch (e) {
        console.error('[WEBHOOK_ERROR]', e);
        try {
          await lineClient.replyMessage(event.replyToken, { type: 'text', text: 'ごめんね、少しうまくいかなかったみたい。' } as any);
        } catch {}
      }
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok' });
}