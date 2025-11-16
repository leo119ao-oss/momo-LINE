import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findOrCreateParticipant } from '@/lib/participants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // 参加者を取得または作成
    const participant = await findOrCreateParticipant(user_id);

    // 最新の記事を取得
    const { data: article, error: articleError } = await supabaseAdmin
      .from('articles')
      .select('id, title, body, status, submitted_at, created_at, updated_at')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (articleError) {
      console.error('[COACH_STATUS] Article fetch error:', articleError);
      return NextResponse.json(
        { error: '記事の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      participant_id: participant.id,
      article_id: article?.id || null,
      title: article?.title || '',
      body: article?.body || '',
      status: article?.status || 'draft',
      submitted_at: article?.submitted_at || null,
    });
  } catch (error: any) {
    console.error('[COACH_STATUS] Error:', error);
    return NextResponse.json(
      { error: 'コーチ状態の取得に失敗しました' },
      { status: 500 }
    );
  }
}

