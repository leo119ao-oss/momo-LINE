import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const outlineSchema = z.object({
  participant_id: z.string().uuid(),
  article_id: z.string().uuid().optional(),
  qa_context: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
});

const SYSTEM_PROMPT = `あなたはMomo。母親コミュニティにおけるAIコンパニオンとして、参加者の「書く」体験を支えるAIです。

【あなたの役割】
- ユーザーとの対話内容から、記事の構成案（アウトライン）を生成する
- 300-500字で書けるような構成を提案する
- 完璧を求めず、思いついたことから書けるよう促す

【アウトラインの形式】
- タイトル: 1つ
- ポイント: 3-5個の箇条書き

【出力形式】
JSON形式で以下のように出力してください：
{
  "outlines": [
    {
      "title": "タイトル",
      "points": ["ポイント1", "ポイント2", "ポイント3"]
    }
  ]
}

複数のアウトライン案を2-3個生成してください。`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[COACH_OUTLINE] Request body:', JSON.stringify({ 
      participant_id: body.participant_id, 
      article_id: body.article_id,
      qa_context_length: body.qa_context?.length || 0 
    }, null, 2));
    
    const { participant_id, article_id, qa_context } = outlineSchema.parse(body);
    
    // qa_contextの検証
    if (!qa_context || qa_context.length === 0) {
      console.error('[COACH_OUTLINE] Empty qa_context');
      return NextResponse.json(
        {
          error: 'バリデーションエラー',
          details: 'qa_contextが空です。対話内容が必要です。',
        },
        { status: 400 }
      );
    }

    // 対話内容をまとめる（長い回答は要約）
    const conversationText = qa_context
      .map((qa, idx) => {
        const truncatedAnswer = qa.answer.length > 500 ? qa.answer.slice(0, 500) + '...' : qa.answer;
        return `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${truncatedAnswer}`;
      })
      .join('\n\n');

    // 対話内容が長すぎる場合は、最新の会話のみを使用（最大5000文字）
    const truncatedConversationText = conversationText.length > 5000 
      ? conversationText.slice(-5000) 
      : conversationText;

    const userPrompt = `以下の対話内容から、記事の構成案（アウトライン）を2-3個生成してください。

対話内容:
${truncatedConversationText}

300-500字で書けるような構成を提案してください。完璧を求めず、思いついたことから書けるよう促す構成にしてください。`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 1200,
      });
    } catch (aiError: any) {
      console.error('[COACH_OUTLINE] OpenAI API error:', JSON.stringify(aiError, null, 2));
      console.error('[COACH_OUTLINE] OpenAI API error code:', aiError?.code);
      console.error('[COACH_OUTLINE] OpenAI API error status:', aiError?.status);
      console.error('[COACH_OUTLINE] OpenAI API error type:', aiError?.type);
      
      // レート制限エラーの場合
      if (aiError?.status === 429 || aiError?.code === 'rate_limit_exceeded') {
        return NextResponse.json(
          {
            error: 'アウトラインの生成に失敗しました',
            details: 'AIのリクエストが多すぎます。しばらく待ってから再度お試しください。',
            code: 'RATE_LIMIT',
          },
          { status: 429 }
        );
      }
      
      // タイムアウトエラーの場合
      if (aiError?.code === 'timeout' || aiError?.message?.includes('timeout')) {
        return NextResponse.json(
          {
            error: 'アウトラインの生成に失敗しました',
            details: 'AIの応答がタイムアウトしました。もう一度お試しください。',
            code: 'TIMEOUT',
          },
          { status: 504 }
        );
      }
      
      throw new Error(`AI生成エラー: ${aiError?.message || 'Unknown error'}`);
    }

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';
    console.log('[COACH_OUTLINE] AI response:', responseText.substring(0, 200)); // デバッグ用
    
    let parsedResponse: { outlines?: Array<{ title: string; points: string[] }> };

    try {
      parsedResponse = JSON.parse(responseText);
      console.log('[COACH_OUTLINE] Parsed response:', JSON.stringify(parsedResponse, null, 2));
    } catch (parseError: any) {
      console.error('[COACH_OUTLINE] JSON parse error:', parseError);
      console.error('[COACH_OUTLINE] Parse error message:', parseError?.message);
      console.error('[COACH_OUTLINE] Raw response (first 500 chars):', responseText.substring(0, 500));
      console.error('[COACH_OUTLINE] Raw response (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)));
      
      // JSONパースに失敗した場合のフォールバック
      // ただし、レスポンスが完全に空の場合はエラーを返す
      if (!responseText || responseText.trim() === '' || responseText.trim() === '{}') {
        console.error('[COACH_OUTLINE] Empty or invalid response from AI');
        return NextResponse.json(
          {
            error: 'アウトラインの生成に失敗しました',
            details: 'AIからの応答が無効でした。もう一度お試しください。',
            code: 'INVALID_RESPONSE',
          },
          { status: 500 }
        );
      }
      
      parsedResponse = {
        outlines: [
          {
            title: '今日の気づき',
            points: [
              '今日感じたこと',
              '印象に残った出来事',
              'これから考えたいこと',
            ],
          },
        ],
      };
    }

    const outlines = parsedResponse.outlines || [
      {
        title: '今日の気づき',
        points: [
          '今日感じたこと',
          '印象に残った出来事',
          'これから考えたいこと',
        ],
      },
    ];

    return NextResponse.json({
      ok: true,
      outlines,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'バリデーションエラー',
          details: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
        { status: 400 }
      );
    }

    console.error('[COACH_OUTLINE] Error:', error);
    console.error('[COACH_OUTLINE] Error details:', JSON.stringify(error, null, 2));
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'アウトラインの生成に失敗しました',
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}

