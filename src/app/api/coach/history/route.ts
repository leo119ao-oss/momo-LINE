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
    const participant_id = searchParams.get('participant_id'); // 後方互換性のため残す

    // user_idからparticipant_idを取得（セキュリティのため）
    let verifiedParticipantId: string;
    
    if (user_id) {
      // user_idからparticipantを取得して検証
      const participant = await findOrCreateParticipant(user_id);
      verifiedParticipantId = participant.id;
    } else if (participant_id) {
      // 後方互換性のため、participant_idのみの場合も許可（非推奨）
      verifiedParticipantId = participant_id;
    } else {
      return NextResponse.json(
        { error: 'user_id or participant_id is required' },
        { status: 400 }
      );
    }

    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, title, body, word_count, status, created_at, updated_at, submitted_at, pdf_url')
      .eq('participant_id', verifiedParticipantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[COACH_HISTORY] Fetch error:', error);
      return NextResponse.json(
        { error: '記事履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 要点抽出（gpt-4.1）- 各記事から要点を抽出
    const articlesWithSummary = await Promise.all(
      (articles || []).map(async (article) => {
        if (!article.body || article.body.trim().length === 0) {
          return { ...article, summary: null };
        }

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4.1',
            messages: [
              {
                role: 'system',
                content: 'あなたは記事の要点を抽出するAIです。提供された記事から重要なポイントを簡潔にまとめてください。100文字以内で要約してください。',
              },
              {
                role: 'user',
                content: `以下の記事から要点を抽出してください：\n\n${article.body}`,
              },
            ],
            temperature: 0.7,
            max_tokens: 200,
          });
          const summary = completion.choices[0]?.message?.content?.trim() || null;
          return { ...article, summary };
        } catch (error) {
          console.error('[COACH_HISTORY] AI summary generation error:', error);
          return { ...article, summary: null };
        }
      })
    );

    return NextResponse.json({
      ok: true,
      articles: articlesWithSummary,
    });
  } catch (error: any) {
    console.error('[COACH_HISTORY] Error:', error);
    return NextResponse.json(
      { error: '記事履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}

