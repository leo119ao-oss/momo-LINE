// src/lib/quiz.ts
// 朝の1分クイズ機能

import { supabaseAdmin } from './supabaseAdmin';
import { searchArticles } from './search';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// アプリのベースURL
const APP = process.env.NEXT_PUBLIC_APP_ORIGIN!;

export interface QuizData {
  id: number;
  question: string;
  choices: string[];
  correct_index: number;
  article_url: string;
}

/**
 * 自動的に記事を検索してクイズを生成する
 */
export async function generateQuizFromAutoSearch(): Promise<QuizData | null> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // クイズに適した記事を検索するクエリ
      const quizQueries = [
        '朝の献立 迷い 減らす コツ',
        '子どもの発熱 予定 崩れた 対処法',
        '家事 効率化 時短 方法',
        '子育て イライラ 解消 コツ',
        '夫婦 コミュニケーション 改善',
        '離乳食 食べない 対処法',
        '寝かしつけ 時間 短縮 方法'
      ];
      
      // ランダムにクエリを選択
      const randomQuery = quizQueries[Math.floor(Math.random() * quizQueries.length)];
      
      // RAG検索で記事を取得
      const hits = await searchArticles(randomQuery);
      
      if (!hits || hits.length === 0) {
        console.log(`Attempt ${attempt}: No articles found for quiz generation`);
        if (attempt === maxRetries) return null;
        continue;
      }
      
      // 最初の記事を使用（スコアが最も高い記事）
      const article = hits[0];
      const content = article.chunk;

    const systemPrompt = `
本文だけから3択クイズを1問作る。
- 難度は易しいが、日常の小さなズレに気づかせる。
- 質問: 60-90字。選択肢: 8-14字×3。正解は1つだが、答えの提示や解説は不要（記事側で分かる）。
- JSON: {question, choices:[..3], correct_index}
- 外部の知識は禁止。本文1本のみを根拠にする。
- 子育て・家事・家族関係に関する内容を優先する。
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content?.trim();
    if (!responseText) return null;

      // JSONパース
      const quizData = JSON.parse(responseText);
      
      // バリデーション
      if (!validateQuizData(quizData)) {
        console.log(`Attempt ${attempt}: Generated quiz failed validation`);
        if (attempt === maxRetries) return null;
        continue;
      }
      
      // クイズをデータベースに保存
      const { data, error } = await supabaseAdmin
        .from('quiz_master')
        .insert({
          question: quizData.question,
          choices: quizData.choices,
          correct_index: quizData.correct_index,
          article_url: article.url
        })
        .select()
        .single();

      if (error || !data) {
        console.error(`Attempt ${attempt}: Failed to save quiz:`, error);
        if (attempt === maxRetries) return null;
        continue;
      }

      console.log(`Successfully generated quiz on attempt ${attempt}`);
      return {
        id: data.id,
        question: quizData.question,
        choices: quizData.choices,
        correct_index: quizData.correct_index,
        article_url: article.url
      };

    } catch (error) {
      console.error(`Attempt ${attempt}: Failed to generate quiz:`, error);
      if (attempt === maxRetries) {
        // フォールバック: 固定クイズを返す
        return await generateFallbackQuiz();
      }
    }
  }
  
  return null;
}

/**
 * フォールバック用の固定クイズ
 */
async function generateFallbackQuiz(): Promise<QuizData | null> {
  try {
    const fallbackQuiz = {
      question: "朝の時間を有効活用するコツはどれでしょうか？",
      choices: [
        "前夜に準備を済ませる",
        "朝一番でメールチェック",
        "家族全員で朝食を作る"
      ],
      correct_index: 0,
      article_url: "https://www.okaasan.net/sample-article"
    };

    const { data, error } = await supabaseAdmin
      .from('quiz_master')
      .insert({
        question: fallbackQuiz.question,
        choices: fallbackQuiz.choices,
        correct_index: fallbackQuiz.correct_index,
        article_url: fallbackQuiz.article_url
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to save fallback quiz:', error);
      return null;
    }

    return {
      id: data.id,
      question: fallbackQuiz.question,
      choices: fallbackQuiz.choices,
      correct_index: fallbackQuiz.correct_index,
      article_url: fallbackQuiz.article_url
    };
  } catch (error) {
    console.error('Failed to generate fallback quiz:', error);
    return null;
  }
}

/**
 * 指定された記事URLからクイズを生成する（手動指定用）
 */
export async function generateQuizFromArticle(articleUrl: string): Promise<QuizData | null> {
  try {
    // 記事の内容を取得（簡易版）
    const response = await fetch(articleUrl);
    const html = await response.text();
    
    // 簡単なHTMLパース
    const content = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000); // 最初の2000文字を使用

    const systemPrompt = `
本文だけから3択クイズを1問作る。
- 難度は易しいが、日常の小さなズレに気づかせる。
- 質問: 60-90字。選択肢: 8-14字×3。正解は1つだが、答えの提示や解説は不要（記事側で分かる）。
- JSON: {question, choices:[..3], correct_index}
- 外部の知識は禁止。本文1本のみを根拠にする。
- 子育て・家事・家族関係に関する内容を優先する。
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content?.trim();
    if (!responseText) return null;

    // JSONパース
    const quizData = JSON.parse(responseText);
    
    // クイズをデータベースに保存
    const { data, error } = await supabaseAdmin
      .from('quiz_master')
      .insert({
        question: quizData.question,
        choices: quizData.choices,
        correct_index: quizData.correct_index,
        article_url: articleUrl
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to save quiz:', error);
      return null;
    }

    return {
      id: data.id,
      question: quizData.question,
      choices: quizData.choices,
      correct_index: quizData.correct_index,
      article_url: articleUrl
    };

  } catch (error) {
    console.error('Failed to generate quiz from article:', error);
    return null;
  }
}

/**
 * クイズデータのバリデーション
 */
export function validateQuizData(quizData: any): boolean {
  if (!quizData || typeof quizData !== 'object') return false;
  
  // 必須フィールドのチェック
  if (!quizData.question || typeof quizData.question !== 'string') return false;
  if (!Array.isArray(quizData.choices) || quizData.choices.length !== 3) return false;
  if (typeof quizData.correct_index !== 'number' || quizData.correct_index < 0 || quizData.correct_index > 2) return false;
  
  // 質問文の長さチェック
  if (quizData.question.length < 20 || quizData.question.length > 120) return false;
  
  // 選択肢の長さチェック
  for (const choice of quizData.choices) {
    if (typeof choice !== 'string' || choice.length < 5 || choice.length > 20) return false;
  }
  
  return true;
}

/**
 * 通知用の短いフック文を生成
 */
export async function generateShortHook(question: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '質問文から18-24文字で「ん？」となる一言を生成。例：「朝の献立、迷いを減らすコツは？」→「献立は先に決める？」'
        },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
    });

    return completion.choices[0].message.content?.trim() || question.slice(0, 20);
  } catch (error) {
    console.error('Failed to generate short hook:', error);
    return question.slice(0, 20);
  }
}

/**
 * Flexメッセージを構築（URI遷移版）
 */
export function buildTeaserFlex(q: QuizData) {
  return {
    type: "flex",
    altText: "朝の1分クイズ",
    contents: {
      type: "bubble",
      body: {
        type: "box", 
        layout: "vertical", 
        spacing: "md",
        contents: [
          { 
            type: "text", 
            text: "朝の1分クイズ", 
            size: "sm", 
            weight: "bold", 
            color: "#FF7F9E" 
          },
          { 
            type: "text", 
            text: q.question, 
            wrap: true, 
            size: "md" 
          },
          { 
            type: "box", 
            layout: "vertical", 
            spacing: "sm", 
            contents: q.choices.map((c, i) => ({
              type: "button", 
              style: "secondary",
              action: { 
                type: "uri",
                label: `${["A", "B", "C"][i]} ${c}`,
                uri: `${APP}/read?quizId=${q.id}&picked=${i}` // どれを押したかだけ渡す
              }
            }))
          },
          { 
            type: "button", 
            style: "primary",
            action: { 
              type: "uri", 
              label: "記事で答えを見る（30秒）",
              uri: `${APP}/read?quizId=${q.id}` // 直接記事へ
            }
          }
        ]
      }
    }
  };
}

/**
 * クイズログを記録
 */
export async function logQuizAction(
  participantId: string,
  quizId: number,
  action: 'sent' | 'tap_choice' | 'open',
  choiceIndex?: number,
  articleUrl?: string
) {
  try {
    await supabaseAdmin
      .from('quiz_logs')
      .insert({
        participant_id: participantId,
        quiz_id: quizId,
        action,
        choice_index: choiceIndex,
        article_url: articleUrl
      });
  } catch (error) {
    console.error('Failed to log quiz action:', error);
  }
}
