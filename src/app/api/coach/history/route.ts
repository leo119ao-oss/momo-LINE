import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const participant_id = searchParams.get('participant_id');

    if (!participant_id) {
      return NextResponse.json(
        { error: 'participant_id is required' },
        { status: 400 }
      );
    }

    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, title, body, word_count, status, created_at, updated_at, submitted_at, pdf_url')
      .eq('participant_id', participant_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[COACH_HISTORY] Fetch error:', error);
      return NextResponse.json(
        { error: '記事履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      articles: articles || [],
    });
  } catch (error: any) {
    console.error('[COACH_HISTORY] Error:', error);
    return NextResponse.json(
      { error: '記事履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}

