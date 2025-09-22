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
import { DEEPENING_BY_EMOTION } from '@/config/conversationMap';
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
  return {
    type: 'flex' as const,
    altText: 'いまの気分を選んでください',
    contents: {
      type: 'bubble' as const,
      body: {
        type: 'box' as const,
        layout: 'vertical' as const,
        contents: [
          {
            type: 'text' as const,
            text: 'いまの気分は？',
            size: 'lg' as const,
            weight: 'bold' as const,
            color: '#333333',
            align: 'center' as const
          },
          {
            type: 'box',
            layout: 'vertical' as const,
            spacing: 'md' as const,
            margin: 'lg' as const,
            contents: [
              {
                type: 'box' as const,
                layout: 'horizontal' as const,
                spacing: 'sm' as const,
                contents: [
                  {
                    type: 'button' as const,
                    action: {
                      type: 'postback' as const,
                      label: '😊',
                      data: 'emotion:smile'
                    },
                    style: 'primary' as const,
                    color: '#FFB6C1',
                    height: 'md'
                  },
                  {
                    type: 'button' as const,
                    action: {
                      type: 'postback' as const,
                      label: '😐',
                      data: 'emotion:neutral'
                    },
                    style: 'primary' as const,
                    color: '#D3D3D3',
                    height: 'md'
                  },
                  {
                    type: 'button' as const,
                    action: {
                      type: 'postback' as const,
                      label: '😩',
                      data: 'emotion:tired'
                    },
                    style: 'primary' as const,
                    color: '#FFA07A',
                    height: 'md'
                  }
                ]
              },
              {
                type: 'box' as const,
                layout: 'horizontal' as const,
                spacing: 'sm' as const,
                contents: [
                  {
                    type: 'button' as const,
                    action: {
                      type: 'postback' as const,
                      label: '😡',
                      data: 'emotion:anger'
                    },
                    style: 'primary' as const,
                    color: '#FF6B6B',
                    height: 'md'
                  },
                  {
                    type: 'button' as const,
                    action: {
                      type: 'postback' as const,
                      label: '😢',
                      data: 'emotion:sad'
                    },
                    style: 'primary' as const,
                    color: '#87CEEB',
                    height: 'md'
                  },
                  {
                    type: 'button' as const,
                    action: {
                      type: 'postback' as const,
                      label: '🤔',
                      data: 'emotion:think'
                    },
                    style: 'primary' as const,
                    color: '#DDA0DD',
                    height: 'md'
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  };
}

function deepeningQuickReply(emotionKey: string) {
  const m = DEEPENING_BY_EMOTION[emotionKey] ?? { a: "A", b: "B" };
  return {
    type: 'flex' as const,
    altText: 'どちらが近いですか？',
    contents: {
      type: 'bubble' as const,
      body: {
        type: 'box' as const,
        layout: 'vertical' as const,
        contents: [
          {
            type: 'text' as const,
            text: 'どちらが近いかな？',
            size: 'lg' as const,
            weight: 'bold' as const,
            color: '#333333',
            align: 'center' as const
          },
          {
            type: 'box',
            layout: 'vertical' as const,
            spacing: 'md' as const,
            margin: 'lg' as const,
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: m.a,
                  data: `deep:${emotionKey}:${m.a}`
                },
                style: 'primary',
                color: '#FF8FA3',
                    height: 'md' as const,
                margin: 'sm' as const
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: m.b,
                  data: `deep:${emotionKey}:${m.b}`
                },
                style: 'primary',
                color: '#FF8FA3',
                    height: 'md' as const,
                margin: 'sm' as const
              },
              {
                type: 'button',
                action: {
                      type: 'message' as const,
                  label: 'ほかにもある',
                  text: '自由入力します'
                },
                    style: 'secondary' as const,
                color: '#E5E7EB',
                    height: 'md' as const,
                margin: 'sm' as const
              }
            ]
          }
        ]
      }
    }
  };
}

function endOrDiaryQR() {
  return {
    type: 'flex' as const,
    altText: 'どうしますか？',
    contents: {
      type: 'bubble' as const,
      body: {
        type: 'box' as const,
        layout: 'vertical' as const,
        contents: [
          {
            type: 'text' as const,
            text: 'どうしますか？',
            size: 'lg' as const,
            weight: 'bold' as const,
            color: '#333333',
            align: 'center' as const
          },
          {
            type: 'box',
            layout: 'vertical' as const,
            spacing: 'md' as const,
            margin: 'lg' as const,
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '📝 今日の1分に残す',
                  data: 'diary:save'
                },
                style: 'primary',
                color: '#4CAF50',
                    height: 'md' as const,
                margin: 'sm' as const
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '👋 ここで終わる',
                  data: 'session:end'
                },
                    style: 'secondary' as const,
                color: '#9E9E9E',
                    height: 'md' as const,
                margin: 'sm' as const
              }
            ]
          }
        ]
      }
    }
  };
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
          // テキストメッセージとFlexメッセージを分けて送信
          await lineClient.replyMessage(event.replyToken, {
            type: 'text' as const,
            text: 'こんにちは！'
          } as any);
          
          // Flexメッセージを別途送信
          await lineClient.pushMessage(userId, emotionQuickReply() as any);
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
            
            // 確認メッセージを送信
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: `${selectedEmotion}を選んだんだね。もう少し詳しく教えてもらえる？`
            } as any);
            
            // Flexメッセージを別途送信
            await lineClient.pushMessage(userId, deepeningQuickReply(emotionKey) as any);
            continue;
          }
          if (data.startsWith('deep:')) {
            try {
              const [, emotionKey, choice] = data.split(':');
              const userText = `${emotionKey}:${choice}`;
              
              console.log(`[WEBHOOK] Processing deep postback: emotionKey=${emotionKey}, choice=${choice}`);
              
            // 傾聴応答を生成
            console.log('[WEBHOOK] Generating reflective response...');
            const base = await generateReflectiveCore(userText);
            console.log('[WEBHOOK] Generated reflective response:', base.substring(0, 100) + '...');

            const gate = shouldAddInsightCue(userText, {
              hasEmotionSelected: true,
              hasDeepeningChoice: true,
              emotion: emotionKey
            });

            let insight = '';
            if (gate.ok) {
              console.log('[WEBHOOK] Generating insight cue...');
              const comp = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                temperature: 0.3,
                messages: [
                  { role: 'system', content: INSIGHT_CUE_SYSTEM },
                  { role: 'user', content: INSIGHT_CUE_USER(userText) }
                ]
              }, {
                timeout: (Number(process.env.GEN_TIMEOUT_SECONDS ?? 8) * 1000)
              } as any);
              insight = comp.choices?.[0]?.message?.content?.trim() ?? '';
              console.log('[WEBHOOK] Generated insight:', insight);
            }

            // 確認メッセージ + 傾聴応答を1つのメッセージで送信
            const fullResponse = `「${choice}」について聞かせてくれてありがとう。\n\n${[base, insight].filter(Boolean).join('\n')}`;
            
            console.log('[WEBHOOK] Sending combined response...');
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: fullResponse
            } as any);
            
            // 少し遅延してからFlexメッセージを送信（レート制限回避）
            console.log('[WEBHOOK] Sending end/diary quick reply after delay...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒遅延
            
            await lineClient.pushMessage(userId, endOrDiaryQR() as any);
            console.log('[WEBHOOK] Deep postback processing completed successfully');
              continue;
            } catch (deepError) {
              console.error('[WEBHOOK] Error in deep postback processing:', deepError);
              console.error('[WEBHOOK] Error details:', JSON.stringify(deepError, null, 2));
              
              // エラーが発生した場合でも、ユーザーにはエラーメッセージを送信
              try {
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'すみません、処理中にエラーが発生しました。もう一度お試しください。'
                } as any);
              } catch (replyError) {
                console.error('[WEBHOOK] Failed to send error message:', replyError);
                // リプライも失敗した場合は、pushMessageを試す
                try {
                  await lineClient.pushMessage(userId, {
                    type: 'text',
                    text: 'すみません、システムエラーが発生しました。しばらく時間をおいてからお試しください。'
                  } as any);
                } catch (pushError) {
                  console.error('[WEBHOOK] Failed to send push error message:', pushError);
                }
              }
              continue;
            }
          }
          if (data === 'diary:save') {
            // 最後の整理をそのまま保存する簡易版（詳細は /api/diary/create に出す場合はここでフェッチ）
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: '今日の1分にメモしたよ。ここで終わる？それとも続ける？',
              ...qr([{ label: "つづける", data: "session:cont" }, { label: "ここで終わる", data: "session:end" }])
            } as any);
            continue;
          }
          if (data === 'session:end') {
            await endSession(session.id);
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: 'ここで一区切りにするね。おつかれさま。'
            } as any);
            continue;
          }
          if (data === 'session:cont') {
            await lineClient.replyMessage(event.replyToken, {
              type: 'text' as const,
              text: 'OK。続けよう。'
            } as any);
            
            // Flexメッセージを別途送信
            await lineClient.pushMessage(userId, emotionQuickReply() as any);
            continue;
          }
        }

        // MESSAGE（text/image 等）。textは自由入力扱い
        if (event.type === 'message' && event.message?.type === 'text') {
          const text: string = event.message.text?.trim() ?? '';

          // 自由入力の場合は従来の傾聴応答
          const base = await generateReflectiveCore(text);

          // 傾聴応答を送信
          await lineClient.replyMessage(event.replyToken, {
            type: 'text' as const,
            text: base
          } as any);
          
          // Flexメッセージを別途送信
          await lineClient.pushMessage(userId, endOrDiaryQR() as any);
          continue;
        }

        // 他タイプ（スタンプ等）はミニ応答のみ
        await lineClient.replyMessage(event.replyToken, { type: 'text', text: '受け取ったよ。' } as any);

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