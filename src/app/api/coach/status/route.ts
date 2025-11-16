import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findOrCreateParticipant } from '@/lib/participants';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

    // 最新の下書き記事を取得（submittedの記事は除外）
    const { data: article, error: articleError } = await supabaseAdmin
      .from('articles')
      .select('id, title, body, status, submitted_at, created_at, updated_at')
      .eq('participant_id', participant.id)
      .eq('status', 'draft')
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

    // 進捗判定（gpt-4.1-mini）- 記事の進捗状況を判定
    let progressAssessment = null;
    if (article) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: 'あなたは記事の進捗状況を判定するAIです。提供された記事の情報から、進捗状況を簡潔に評価してください。',
            },
            {
              role: 'user',
              content: `記事のタイトル: ${article.title || '未設定'}\n本文の文字数: ${article.body?.length || 0}文字\nステータス: ${article.status}\n\nこの記事の進捗状況を簡潔に評価してください。`,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
        });
        progressAssessment = completion.choices[0]?.message?.content?.trim() || null;
      } catch (error) {
        console.error('[COACH_STATUS] AI progress assessment error:', error);
      }
    }

    return NextResponse.json({
      ok: true,
      participant_id: participant.id,
      article_id: article?.id || null,
      title: article?.title || '',
      body: article?.body || '',
      status: article?.status || 'draft',
      submitted_at: article?.submitted_at || null,
      progress_assessment: progressAssessment,
    });
  } catch (error: any) {
    console.error('[COACH_STATUS] Error:', error);
    return NextResponse.json(
      { error: 'コーチ状態の取得に失敗しました' },
      { status: 500 }
    );
  }
}

