import { NextRequest, NextResponse } from 'next/server';
import { searchArticles } from '@/lib/search';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { contact, query, limit = 5 } = await request.json();
    
    if (!contact || !query) {
      return NextResponse.json(
        { error: 'contact and query are required' },
        { status: 400 }
      );
    }

    console.log('[ARTICLE_SEARCH] Searching articles for:', { contact, query, limit });

    // 記事を検索
    const articles = await searchArticles(query);
    
    if (!articles || articles.length === 0) {
      return NextResponse.json({
        articles: [],
        totalCount: 0,
        searchQuery: query,
        message: '該当する記事が見つかりませんでした。'
      });
    }

    // 結果を整形（要約を生成）
    const formattedArticles = await Promise.all(
      articles.slice(0, limit).map(async (article) => {
        // AIで要約を生成
        let summary = article.chunk?.substring(0, 100) + '...' || '概要なし';
        
        if (article.chunk && article.chunk.length > 50) {
          try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
            const completion = await openai.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                {
                  role: 'system',
                  content: 'あなたは記事の要約を生成するAIです。提供された記事の内容を、母親が理解しやすいように簡潔に要約してください。100文字以内で、要点を明確に伝えてください。'
                },
                {
                  role: 'user',
                  content: `以下の記事を要約してください：\n\n${article.chunk}`
                }
              ],
              temperature: 0.3,
              max_tokens: 100
            });
            
            const aiSummary = completion.choices[0]?.message?.content?.trim();
            if (aiSummary) {
              summary = aiSummary;
            }
          } catch (error) {
            console.error('[ARTICLE_SEARCH] Error generating summary:', error);
            // エラーの場合は元の要約を使用
          }
        }
        
        return {
          title: article.title || 'タイトルなし',
          url: article.url || '#',
          summary: summary,
          relevance: `${Math.round((article.score || 0) * 100)}%`,
          similarity: article.score || 0
        };
      })
    );

    // 検索ログを保存
    try {
      await supabaseAdmin.from('search_logs').insert({
        user_id: contact,
        query,
        result_count: formattedArticles.length,
        search_type: 'article_search'
      });
    } catch (logError) {
      console.error('[ARTICLE_SEARCH] Failed to log search:', logError);
    }

    return NextResponse.json({
      articles: formattedArticles,
      totalCount: articles.length,
      searchQuery: query
    });

  } catch (error) {
    console.error('[ARTICLE_SEARCH] Error:', error);
    return NextResponse.json(
      { error: '記事検索中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
