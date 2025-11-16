import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// 不自然な会話を検知・修正する関数
function validateAndFixQuestion(question: string, previousAnswers: Array<{ question: string; answer: string }>): string {
  // ① 前の質問と意味が重複していないかチェック
  if (previousAnswers.length > 0) {
    const lastQuestion = previousAnswers[previousAnswers.length - 1].question.toLowerCase();
    const questionLower = question.toLowerCase();
    
    // 同じレイヤーの質問かチェック（簡易版：キーワードベース）
    const questionTypes = {
      feeling: ['気持ち', '感じ', '感情', 'どう思', 'どんな気持ち'],
      scene: ['シーン', '場面', '瞬間', 'とき', 'そのとき', 'どんな様子'],
      background: ['背景', 'これまで', '練習', '努力', '経緯'],
      value: ['気づき', '価値観', '似てる', '自分自身'],
    };
    
    // 前の質問のタイプを判定
    const lastQuestionType = Object.keys(questionTypes).find(type =>
      questionTypes[type as keyof typeof questionTypes].some(keyword => lastQuestion.includes(keyword))
    );
    
    // 現在の質問のタイプを判定
    const currentQuestionType = Object.keys(questionTypes).find(type =>
      questionTypes[type as keyof typeof questionTypes].some(keyword => questionLower.includes(keyword))
    );
    
    // 同じタイプの質問が連続している場合は修正
    if (lastQuestionType && currentQuestionType === lastQuestionType) {
      console.warn('[COACH_QUESTIONS] Duplicate question type detected, regenerating...');
      // 次の段階の質問に進む
      if (currentQuestionType === 'feeling') {
        question = 'その背景には、どんなことがあったんでしょう？';
      } else if (currentQuestionType === 'scene') {
        question = 'そのとき、ご自身はどんな気持ちでしたか？';
      } else if (currentQuestionType === 'background') {
        question = 'その姿を見て、あなた自身はどんなことを感じましたか？';
      }
    }
  }
  
  // ② 感情を決めつけていないかチェック
  const assumptionPatterns = [
    /嬉し(かった|そう|い)/,
    /悲し(かった|そう|い)/,
    /楽し(かった|そう|い)/,
    /辛(かった|そう|い)/,
    /〜ですね$/,
    /〜ですよね$/,
  ];
  
  if (assumptionPatterns.some(pattern => pattern.test(question))) {
    console.warn('[COACH_QUESTIONS] Emotion assumption detected, fixing...');
    // 決めつけを「どんな気持ちでしたか？」に変更
    question = question.replace(/[。、]?.*(ですね|ですよね|でしたね).*/, '');
    if (!question.includes('気持ち') && !question.includes('感じ')) {
      question = 'そのとき、どんな気持ちでしたか？';
    }
  }
  
  // ③ momoの人格ルール違反がないかチェック
  const violationPatterns = [
    /素敵(ですね|です)/g,
    /すごい(ですね|です)/g,
    /〜すべき/g,
    /〜に違いありません/g,
  ];
  
  let violationCount = 0;
  violationPatterns.forEach(pattern => {
    const matches = question.match(pattern);
    if (matches) violationCount += matches.length;
  });
  
  if (violationCount > 1) {
    console.warn('[COACH_QUESTIONS] Personality violation detected, fixing...');
    // 過度な褒め言葉を削除
    question = question.replace(/素敵(ですね|です)[。、]?/g, '');
    question = question.replace(/すごい(ですね|です)[。、]?/g, '');
  }
  
  // ④ 1ターンで質問が2つ以上入っていないかチェック
  const questionMarkCount = (question.match(/？/g) || []).length + (question.match(/\?/g) || []).length;
  if (questionMarkCount > 1) {
    console.warn('[COACH_QUESTIONS] Multiple questions detected, fixing...');
    // 最初の質問のみを残す
    const firstQuestionEnd = Math.min(
      question.indexOf('？') !== -1 ? question.indexOf('？') + 1 : question.length,
      question.indexOf('?') !== -1 ? question.indexOf('?') + 1 : question.length
    );
    question = question.substring(0, firstQuestionEnd);
  }
  
  // ⑤ 会話の深掘り段階が逆行していないかチェック（簡易版）
  if (previousAnswers.length >= 2) {
    const lastAnswer = previousAnswers[previousAnswers.length - 1].answer.toLowerCase();
    
    // 感情について既に話しているのに、また感情を聞く場合は修正
    if ((lastAnswer.includes('気持ち') || lastAnswer.includes('感じ') || lastAnswer.includes('嬉') || lastAnswer.includes('悲')) &&
        question.toLowerCase().includes('気持ち')) {
      // 背景や気づきへ進む
      if (!lastAnswer.includes('練習') && !lastAnswer.includes('努力')) {
        question = 'その背景には、どんなことがあったんでしょう？';
      } else {
        question = 'その姿を見て、あなた自身はどんなことを感じましたか？';
      }
    }
  }
  
  return question.trim() || 'もう少し詳しく教えてください。';
}

const questionsSchema = z.object({
  previousAnswers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
  currentStep: z.number().int().min(0),
});

const SYSTEM_PROMPT = `あなたは「momo」という、ユーザーの体験を丁寧に引き出す対話パートナーです。

【momoの役割】
- 出来事 → シーン → 感情 → 背景 → 気づき の順で深掘りする
- ユーザーの言葉を引用しながら返す
- 感情を決めつけず、「どんな気持ちでしたか？」と尋ねる
- 同じ問いを繰り返さない
- momo の人格：優しく、控えめに共感し、押しつけず、話を促す

【あなたが生成するもの】
- 次に尋ねるべき「1つの質問文」のみ

【守るべき構造】
1. ユーザーが具体的なシーンを言っていない → シーンを聞く
2. シーンを言った → 表情・様子を聞く
3. 感情を言っていない → 感情を聞く
4. 背景や努力の話がある → そこを深掘り
5. 自分自身への気づきが出た → 価値観や意味へつなげる
6. 素材が揃ったら → 記事化のためのまとめ質問へ

【momoの話し方のルール】
✅ YES（正しい）
- 「そのとき、ご自身はどんな気持ちでしたか？」
- 「今の話で、特に印象に残っている部分はどこですか？」
- 「もし思い当たれば教えてくださいね」
- 「〜だったんですね。お話しありがとう。」（感謝は控えめ）

❌ NO（禁止）
- 「素敵ですね！」連発
- 「嬉しかったんですね」（←決めつけ）
- 「〜すべきです」
- 「〜に違いありません」
- 同じ質問の繰り返し

【禁止事項】
- 決めつけの共感
- 同じレイヤーの質問を繰り返す
- 「素敵」「すごい」などの浅い褒め言葉の連発`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { previousAnswers } = questionsSchema.parse(body);

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
      ? '最初の質問を生成してください。「今日はどんなことがあったんでしょう？『これを書き残したいな』と思うようなことがあれば、少し教えてください。」というような、素材収集の質問を1つ生成してください。'
      : `これまでの対話を踏まえて、次の質問を1つ生成してください。深掘り構造（出来事→シーン→感情→背景→気づき）に沿って、適切な段階の質問を生成してください。`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    let question = completion.choices[0]?.message?.content?.trim() || '今日感じたことや気づきがあれば、自由に教えてください。';

    // 不自然な会話を検知するチェックロジック
    question = validateAndFixQuestion(question, previousAnswers);

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

    // モデル名エラーの詳細をログに出力
    if (error?.message?.includes('model') || error?.code === 'model_not_found') {
      console.error('[COACH_QUESTIONS] Model error:', {
        message: error.message,
        code: error.code,
        model: 'gpt-4.1-mini',
        suggestion: 'モデル名が正しいか、APIキーにアクセス権限があるか確認してください',
      });
    }

    console.error('[COACH_QUESTIONS] Error:', error);
    return NextResponse.json(
      { 
        error: '質問の生成に失敗しました',
        details: error?.message || 'Unknown error',
        model: 'gpt-4.1-mini',
      },
      { status: 500 }
    );
  }
}

