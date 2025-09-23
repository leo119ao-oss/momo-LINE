// src/lib/articleRecommender.ts
// 完成した記事に基づく関連記事紹介機能

import { searchArticles } from './search';
import { type RagHit } from './rag';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type ArticleRecommendation = {
  articles: Array<{
    title: string;
    url: string;
    relevance: string;
    excerpt: string;
  }>;
  recommendationMessage: string;
}

// 記事内容に基づく関連記事の推薦
export async function recommendRelatedArticles(
  diaryContent: string,
  participantId: string
): Promise<ArticleRecommendation> {
  try {
    // 日記内容からキーワードを抽出
    const keywords = await extractKeywordsFromDiary(diaryContent);
    
    // 関連記事を検索
    const searchQuery = keywords.join(' ');
    const articles = await searchArticles(searchQuery);
    
    if (articles.length === 0) {
      return {
        articles: [],
        recommendationMessage: '関連する記事が見つかりませんでした。'
      };
    }

    // 関連記事の情報を整理
    const recommendedArticles = articles.slice(0, 3).map(article => ({
      title: article.title || '関連記事',
      url: article.url,
      relevance: generateRelevanceExplanation(diaryContent, article),
      excerpt: generateExcerpt(article.chunk)
    }));

    // 推奨メッセージの生成
    const recommendationMessage = await generateRecommendationMessage(recommendedArticles);

    return {
      articles: recommendedArticles,
      recommendationMessage
    };
  } catch (error) {
    console.error('Article recommendation failed:', error);
    return {
      articles: [],
      recommendationMessage: '関連記事の検索中にエラーが発生しました。'
    };
  }
}

// 日記内容からキーワードを抽出
async function extractKeywordsFromDiary(diaryContent: string): Promise<string[]> {
  const prompt = `
以下の日記内容から、関連記事を検索するためのキーワードを抽出してください。

【日記内容】
${diaryContent}

【指示】
1. 子育てや母親に関連するキーワードを抽出
2. 感情や状況を表すキーワードを含める
3. 5-8個のキーワードを抽出
4. 一般的すぎるキーワードは避ける

キーワードをカンマ区切りで回答してください。
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      return raw.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }
  } catch (error) {
    console.error('Keyword extraction failed:', error);
  }
  
  // フォールバック: 基本的なキーワード
  return ['子育て', '母親', '育児'];
}

// 関連性の説明を生成
function generateRelevanceExplanation(diaryContent: string, article: RagHit): string {
  const diaryKeywords = diaryContent.split(' ').filter(word => word.length > 2);
  const articleKeywords = article.keywords || [];
  
  const commonKeywords = diaryKeywords.filter(keyword => 
    articleKeywords.some(ak => ak.includes(keyword) || keyword.includes(ak))
  );
  
  if (commonKeywords.length > 0) {
    return `「${commonKeywords.slice(0, 2).join('、')}」に関連する記事です`;
  }
  
  return 'あなたの体験に関連する記事です';
}

// 記事の抜粋を生成
function generateExcerpt(content: string): string {
  // 最初の200文字を抜粋
  const excerpt = content.substring(0, 200);
  return excerpt.length < content.length ? excerpt + '...' : excerpt;
}

// 推奨メッセージの生成
async function generateRecommendationMessage(articles: Array<{title: string, url: string, relevance: string}>): Promise<string> {
  const prompt = `
以下の関連記事を紹介する温かいメッセージを生成してください。

【関連記事】
${articles.map((article, index) => `${index + 1}. ${article.title} - ${article.relevance}`).join('\n')}

【指示】
1. 温かく、共感的な口調で
2. 記事が役立つことを伝える
3. プレッシャーを感じさせない
4. 2-3文で簡潔に

メッセージのみを回答してください。
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      return raw.trim();
    }
  } catch (error) {
    console.error('Recommendation message generation failed:', error);
  }
  
  return 'あなたの体験に関連する記事を見つけました。参考になるかもしれません。';
}
