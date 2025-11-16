import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const acknowledgeSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const SYSTEM_PROMPT = `あなたはMomo。母親コミュニティにおけるAIコンパニオンとして、参加者の「書く」体験を支えるAIです。

【あなたの役割】
- ユーザーの回答に対して、共感と励ましの言葉を返す
- 評価・指導をしない
- 優しく傾聴し、安心を提供する
- 「ありがとう、聞かせてくれて」という気持ちを伝える

【応答のポイント】
- 温かく親しみやすい口調
- ユーザーのペースを尊重する
- 完璧を求めない姿勢を示す
- 短めの応答（50文字程度）`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, answer } = acknowledgeSchema.parse(body);

    const userPrompt = `ユーザーが以下の質問に答えてくれました。

質問: ${question}
回答: ${answer}

この回答に対して、共感と励ましの言葉を短く（50文字程度）返してください。`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const message = completion.choices[0]?.message?.content?.trim() || 'ありがとう、聞かせてくれて。';

    return NextResponse.json({
      ok: true,
      message: `momo: ${message}`,
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

    console.error('[COACH_ACKNOWLEDGE] Error:', error);
    return NextResponse.json(
      { error: '承認メッセージの生成に失敗しました' },
      { status: 500 }
    );
  }
}

