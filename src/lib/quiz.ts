/**
 * Quizデータのフィールドゆらぎを吸収するヘルパー
 */

export type QuizDataLike = {
  id?: string | number;
  // タイトル候補
  title?: string;
  quiz_title?: string;
  article_title?: string;
  headline?: string;
  // 質問文候補
  question?: string;
  question_text?: string;
  prompt?: string;
  body?: string;
  // 記事URL候補
  article_url?: string;
  articleUrl?: string;
  url?: string;
};

function pickFirstString(...vals: Array<unknown>): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return undefined;
}

export function resolveTeaserFields(quiz: QuizDataLike): {
  id?: string | number;
  title: string;
  question: string;
  article_url: string;
} {
  const title =
    pickFirstString(quiz.title, quiz.quiz_title, quiz.article_title, quiz.headline) ??
    '今日の1分クイズ';
  const question =
    pickFirstString(quiz.question, quiz.question_text, quiz.prompt, quiz.body) ??
    '記事を読んで答えを考えてみよう！';
  const article_url =
    pickFirstString(quiz.article_url, quiz.articleUrl, quiz.url) ??
    'https://www.okaasan.net/hahagokoro/';
  
  return { id: quiz.id, title, question, article_url };
}

export function resolveQuizId(quiz: QuizDataLike): number | undefined {
  if (typeof quiz.id === 'number') return quiz.id;
  if (typeof quiz.id === 'string') {
    const n = parseInt(quiz.id, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// 既存の関数をプレースホルダーとして追加
export async function generateQuizFromAutoSearch(): Promise<any> {
  // TODO: 実装
  return null;
}

export async function generateQuizFromArticle(articleUrl: string): Promise<any> {
  // TODO: 実装
  return null;
}

export function validateQuizData(quizData: any): boolean {
  // TODO: 実装
  return true;
}

export function buildTeaserFlex(quiz: any): any {
  // TODO: 実装
  return null;
}

export async function generateShortHook(question: string): Promise<string> {
  // TODO: 実装
  return question.slice(0, 20) + '...';
}

export async function logQuizAction(participantId: string | number, quizId: number, action: string, choiceIndex?: number, articleUrl?: string): Promise<void> {
  // TODO: 実装
  console.log('Quiz action logged:', { participantId, quizId, action, choiceIndex, articleUrl });
}
