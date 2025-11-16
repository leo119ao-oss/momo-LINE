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
    const { participant_id, article_id, qa_context } = outlineSchema.parse(body);

    // 対話内容をまとめる
    const conversationText = qa_context
      .map((qa, idx) => `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`)
      .join('\n\n');

    const userPrompt = `以下の対話内容から、記事の構成案（アウトライン）を2-3個生成してください。

対話内容:
${conversationText}

300-500字で書けるような構成を提案してください。完璧を求めず、思いついたことから書けるよう促す構成にしてください。`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 800,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}';
    let parsedResponse: { outlines?: Array<{ title: string; points: string[] }> };

    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      // JSONパースに失敗した場合のフォールバック
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
    return NextResponse.json(
      { error: 'アウトラインの生成に失敗しました' },
      { status: 500 }
    );
  }
}

