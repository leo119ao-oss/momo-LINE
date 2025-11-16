import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const generateSchema = z.object({
  type: z.enum(['lead', 'closer', 'title']),
  context: z.object({
    theme: z.string().optional(),
    outline: z.array(z.string()).optional(),
    tone: z.string().optional(),
  }),
});

const SYSTEM_PROMPT = `あなたはMomo。母親コミュニティにおけるAIコンパニオンとして、参加者の「書く」体験を支えるAIです。

【あなたの役割】
- 記事の書き出し（リード文）やタイトルを生成する
- 優しく親しみやすい文体
- 完璧を求めず、思いついたことから書けるよう促す
- 評価・指導をしない`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, context } = generateSchema.parse(body);

    let userPrompt = '';

    if (type === 'lead') {
      userPrompt = `以下のテーマとアウトラインから、記事の書き出し（リード文）を生成してください。

テーマ: ${context.theme || '今日の気づき'}
アウトライン: ${context.outline?.join('、') || ''}
トーン: ${context.tone || '優しい'}

100-150字程度の書き出しを生成してください。優しく親しみやすい文体で、読者が続きを読みたくなるような書き出しにしてください。`;
    } else if (type === 'title') {
      userPrompt = `以下のテーマから、記事のタイトルを生成してください。

テーマ: ${context.theme || '今日の気づき'}

20-30字程度のタイトルを生成してください。`;
    } else {
      userPrompt = `記事の締めくくり文を生成してください。`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const suggestion = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({
      ok: true,
      suggestion,
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

    console.error('[COACH_GENERATE] Error:', error);
    return NextResponse.json(
      { error: '生成に失敗しました' },
      { status: 500 }
    );
  }
}

