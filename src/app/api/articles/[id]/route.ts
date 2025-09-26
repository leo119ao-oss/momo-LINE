import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = parseInt(params.id);
    
    if (isNaN(articleId)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }

    console.log('[ARTICLE_GET] Fetching article:', articleId);

    const { data: article, error } = await supabaseAdmin
      .from('user_articles')
      .select('*')
      .eq('id', articleId)
      .eq('status', 'published')
      .single();

    if (error || !article) {
      console.error('[ARTICLE_GET] Article not found:', error);
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(article);

  } catch (error) {
    console.error('[ARTICLE_GET] Error:', error);
    return NextResponse.json(
      { error: '記事の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
