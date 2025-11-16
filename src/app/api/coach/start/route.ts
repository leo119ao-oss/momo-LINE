import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findOrCreateParticipant } from '@/lib/participants';
import { z } from 'zod';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const startSchema = z.object({
  user_id: z.string().min(1),
  form_version: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, form_version } = startSchema.parse(body);

    // 参加者を取得または作成
    const participant = await findOrCreateParticipant(user_id);

    // 最新の記事を取得（下書きまたは未提出のもの）
    const { data: existingArticle } = await supabaseAdmin
      .from('articles')
      .select('id, title, body, status, submitted_at')
      .eq('participant_id', participant.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let articleId: string | null = null;

    if (existingArticle) {
      articleId = existingArticle.id;
    } else {
      // 新しい記事を作成
      const { data: newArticle, error: articleError } = await supabaseAdmin
        .from('articles')
        .insert({
          participant_id: participant.id,
          title: null,
          body: null,
          status: 'draft',
          word_count: 0,
          form_version: form_version || 'pen-effect-web',
        })
        .select('id')
        .single();

      if (articleError) {
        console.error('[COACH_START] Article creation error:', articleError);
        return NextResponse.json(
          { error: '記事の作成に失敗しました' },
          { status: 500 }
        );
      }

      articleId = newArticle.id;
    }

    // 初回導入質問生成（gpt-4.1-mini）
    let initialQuestion = null;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたはMomo。母親コミュニティにおけるAIコンパニオンとして、参加者の「書く」体験を支えるAIです。初回の導入質問を1つ生成してください。温かく親しみやすい口調で、今日感じたことや気づきを話しやすくなるような質問を生成してください。',
          },
          {
            role: 'user',
            content: '初回の導入質問を1つ生成してください。',
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });
      initialQuestion = completion.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('[COACH_START] AI question generation error:', error);
    }

    return NextResponse.json({
      ok: true,
      participant_id: participant.id,
      article_id: articleId,
      initial_question: initialQuestion,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'バリデーションエラー',
          details: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
        { status: 400 }
      );
    }

    console.error('[COACH_START] Error:', error);
    return NextResponse.json(
      { error: 'コーチセッションの開始に失敗しました' },
      { status: 500 }
    );
  }
}

