// src/lib/insightGenerator.ts
// お母さん大学記事を活用した示唆生成機能

import { searchArticles } from './search';
import { type RagHit } from './rag';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type InsightResult = {
  insights: string[];
  relatedArticles: Array<{
    title: string;
    url: string;
    relevance: string;
  }>;
}

// 示唆生成のメイン関数
export async function generateInsights(
  emotion: string,
  reason: string,
  conversationContext: string
): Promise<InsightResult> {
  try {
    // 感情と理由に基づいて関連記事を検索
    const searchQuery = `${emotion} ${reason} 子育て 母親`;
    const articles = await searchArticles(searchQuery);
    
    if (articles.length === 0) {
      return {
        insights: ['今日の気持ちを大切にしてくださいね。'],
        relatedArticles: []
      };
    }

    // 記事内容を基に示唆を生成
    const insights = await generateInsightsFromArticles(emotion, reason, articles, conversationContext);
    
    // 関連記事の情報を整理
    const relatedArticles = articles.slice(0, 3).map(article => ({
      title: article.title || '関連記事',
      url: article.url,
      relevance: generateRelevanceExplanation(emotion, reason, article)
    }));

    return {
      insights,
      relatedArticles
    };
  } catch (error) {
    console.error('Insight generation failed:', error);
    return {
      insights: ['今日の気持ちを大切にしてくださいね。'],
      relatedArticles: []
    };
  }
}

// 記事内容から示唆を生成
async function generateInsightsFromArticles(
  emotion: string,
  reason: string,
  articles: RagHit[],
  conversationContext: string
): Promise<string[]> {
  const articleContent = articles.map(article => 
    `タイトル: ${article.title}\n内容: ${article.chunk}`
  ).join('\n\n---\n\n');

  const prompt = `
あなたは母親の内省を支えるAIです。以下の情報を基に、新しい視点や示唆を提供してください。

【ユーザーの状況】
感情: ${emotion}
理由: ${reason}
会話の文脈: ${conversationContext}

【参考記事】
${articleContent}

【指示】
1. 評価や診断は避け、「○○なものの見方をされるんですね」という形で新しい視点を提示
2. 記事の内容を参考に、具体的で実践的な示唆を2-3個提供
3. ユーザーの感情を否定せず、受け入れつつ新しい角度を提案
4. 温かく、共感的な口調で
5. 各示唆は1-2文で簡潔に

以下の形式で回答してください：
示唆1: [具体的な示唆]
示唆2: [具体的な示唆]
示唆3: [具体的な示唆]
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      return parseInsights(raw);
    }
  } catch (error) {
    console.error('Insight generation from articles failed:', error);
  }
  
  return ['今日の気持ちを大切にしてくださいね。'];
}

// 示唆をパースする関数
function parseInsights(rawText: string): string[] {
  const insights: string[] = [];
  const lines = rawText.split('\n');
  
  for (const line of lines) {
    const match = line.match(/示唆\d*:\s*(.+)/);
    if (match) {
      insights.push(match[1].trim());
    }
  }
  
  return insights.length > 0 ? insights : ['今日の気持ちを大切にしてくださいね。'];
}

// 関連記事の関連性説明を生成
function generateRelevanceExplanation(emotion: string, reason: string, article: RagHit): string {
  const keywords = [emotion, reason].filter(Boolean);
  const articleKeywords = article.keywords || [];
  
  const commonKeywords = keywords.filter(keyword => 
    articleKeywords.some(ak => ak.includes(keyword) || keyword.includes(ak))
  );
  
  if (commonKeywords.length > 0) {
    return `「${commonKeywords.join('、')}」に関連する記事です`;
  }
  
  return 'あなたの状況に関連する記事です';
}

// 深堀り質問の生成
export async function generateDeepeningQuestion(
  emotion: string,
  reason: string,
  currentResponse: string
): Promise<string> {
  const prompt = `
ユーザーの回答が短い場合に、より深く理解するための質問を生成してください。

感情: ${emotion}
理由: ${reason}
現在の回答: ${currentResponse}

以下の条件で質問を1つ生成してください：
1. 具体的で答えやすい質問
2. 感情や状況をより深く理解できる内容
3. プレッシャーを感じさせない優しい口調
4. 1文で簡潔に

質問のみを回答してください。
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw === 'string') {
      return raw.trim();
    }
  } catch (error) {
    console.error('Deepening question generation failed:', error);
  }
  
  return 'もう少し詳しく教えてもらえる？';
}
