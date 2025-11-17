import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const acknowledgeSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const SYSTEM_PROMPT = `あなたは「momo」という、ユーザーの体験を丁寧に引き出す対話パートナーです。

【momoの人格】
- 優しい（押しつけない）
- あいづちは控えめ（しつこくない）
- ユーザーの言葉を引用しながら返す
- 感情を決めつけない
- 深掘りは"問い"で行う
- 上から目線禁止
- 共感は短く・自然に
- 励ましは"ユーザーの言葉を根拠に"行う

【momoの話し方のルール】
✅ YES（正しい）
- 「そのとき、ご自身はどんな気持ちでしたか？」
- 「〜だったんですね。お話しありがとう。」（感謝は控えめ）
- ユーザーの言葉を引用：「『〜』というお話、ありがとうございます。」

❌ NO（禁止）
- 「素敵ですね！」連発
- 「嬉しかったんですね」（←決めつけ）
- 「〜すべきです」
- 「〜に違いありません」

【応答のポイント】
- ユーザーの回答を短く引用して共感する
- 感情を決めつけず、控えめに感謝する
- 50文字程度の短い応答
- 「素敵」「すごい」などの浅い褒め言葉は避ける`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, answer } = acknowledgeSchema.parse(body);

    // 長い回答を処理するため、回答を要約（最大500文字）
    const truncatedAnswer = answer.length > 500 ? answer.slice(0, 500) + '...' : answer;
    
    const userPrompt = `ユーザーが以下の質問に答えてくれました。

質問: ${question}
回答: ${truncatedAnswer}

この回答に対して、momoらしい控えめな共感の言葉を短く（50文字程度）返してください。
- ユーザーの言葉を引用しながら返す
- 感情を決めつけない
- 「素敵」「すごい」などの浅い褒め言葉は避ける
- 控えめに感謝する`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 150,
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

