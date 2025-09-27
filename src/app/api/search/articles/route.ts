import { NextRequest, NextResponse } from 'next/server';
import { searchArticles } from '@/lib/search';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    // 結果を整形
    const formattedArticles = articles.slice(0, limit).map((article) => ({
      title: article.title || 'タイトルなし',
      url: article.url || '#',
      summary: article.content?.substring(0, 100) + '...' || '概要なし',
      relevance: `${Math.round((article.similarity || 0) * 100)}%`,
      similarity: article.similarity || 0
    }));

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
