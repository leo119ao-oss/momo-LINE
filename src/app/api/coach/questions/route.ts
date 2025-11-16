import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const questionsSchema = z.object({
  previousAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
  currentStep: z.number().int().min(0),
});

const SYSTEM_PROMPT = `あなたはMomo。母親コミュニティにおけるAIコンパニオンとして、参加者の「書く」体験を支えるAIです。

【あなたの役割】
- 評価・指導をしない
- 「書くこと」を促す問いかけを行う
- 優しく傾聴し、共感・安心を提供する
- 思考や感情を整理し、言葉にする場として機能する

【質問のポイント】
- ユーザーの回答を深掘りする質問を1つ生成する
- 完璧を求めず、思いついたことから書けるよう促す
- 温かく親しみやすい口調
- 評価や分析的な言葉は使わない

【質問の例】
- 「最近の出来事で心に残っていることはありますか？」
- 「子どもとの日常で、どんな瞬間が印象的でしたか？」
- 「今日感じたことや気づきがあれば、自由に教えてください」
- 「言葉にしたい気持ちがあれば、どんなことでも大丈夫ですよ」`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { previousAnswers, currentStep } = questionsSchema.parse(body);

    // 対話履歴を構築
    const conversationHistory = previousAnswers.map((qa) => ({
      role: 'user' as const,
      content: `Q: ${qa.question}\nA: ${qa.answer}`,
    }));

    // 最新の回答からテーマを抽出（簡易版）
    let suggestedTheme: string | null = null;
    if (previousAnswers.length > 0) {
      const lastAnswer = previousAnswers[previousAnswers.length - 1].answer;
      // 簡易的に最初の30文字をテーマ候補とする（実際はAIで抽出すべき）
      suggestedTheme = lastAnswer.slice(0, 30).trim();
    }

    // 質問を生成
    const userPrompt = previousAnswers.length === 0
      ? '最初の質問を生成してください。ユーザーが今日感じたことや気づきを話しやすくなるような質問を1つ生成してください。'
      : `これまでの対話を踏まえて、次の質問を1つ生成してください。ユーザーの回答を深掘りするような質問を生成してください。`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const question = completion.choices[0]?.message?.content?.trim() || '今日感じたことや気づきがあれば、自由に教えてください。';

    return NextResponse.json({
      ok: true,
      question,
      suggestedTheme,
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

    console.error('[COACH_QUESTIONS] Error:', error);
    return NextResponse.json(
      { error: '質問の生成に失敗しました' },
      { status: 500 }
    );
  }
}

