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
      const insertData: any = {
        participant_id: participant.id,
        title: null,
        body: null,
        status: 'draft',
        word_count: 0,
      };
      
      // form_versionカラムが存在する場合のみ追加
      // テーブルにカラムがない場合はエラーになるため、条件付きで追加
      if (form_version) {
        insertData.form_version = form_version;
      }
      
      const { data: newArticle, error: articleError } = await supabaseAdmin
        .from('articles')
        .insert(insertData)
        .select('id')
        .single();

      if (articleError) {
        console.error('[COACH_START] Article creation error:', JSON.stringify(articleError, null, 2));
        
        // form_versionカラムが存在しないエラーの場合、form_versionを除外して再試行
        if (articleError.code === 'PGRST204' && articleError.message?.includes('form_version')) {
          console.warn('[COACH_START] form_version column does not exist, retrying without it...');
          
          // form_versionを除外したデータで再試行
          const retryData: any = {
            participant_id: participant.id,
            title: null,
            body: null,
            status: 'draft',
            word_count: 0,
          };
          
          const { data: retryArticle, error: retryError } = await supabaseAdmin
            .from('articles')
            .insert(retryData)
            .select('id')
            .single();
          
          if (retryError) {
            console.error('[COACH_START] Retry insert error:', JSON.stringify(retryError, null, 2));
            return NextResponse.json(
              { 
                error: '記事の作成に失敗しました',
                details: retryError.message || 'Unknown error',
                code: retryError.code || 'UNKNOWN',
              },
              { status: 500 }
            );
          }
          
          articleId = retryArticle.id;
        } else {
          // 接続エラーやタイムアウトエラーの場合
          if (articleError.code === '08000' || articleError.code === '08003' || articleError.code === '08006' || 
              articleError.message?.includes('connection') || articleError.message?.includes('timeout')) {
            console.error('[COACH_START] Database connection error - possible concurrent access issue');
            return NextResponse.json(
              { 
                error: 'データベース接続エラーが発生しました',
                details: '同時アクセスが多い可能性があります。しばらく待ってから再度お試しください。',
                code: articleError.code || 'CONNECTION_ERROR',
              },
              { status: 503 } // Service Unavailable
            );
          }
          
          return NextResponse.json(
            { 
              error: '記事の作成に失敗しました',
              details: articleError.message || 'Unknown error',
              code: articleError.code || 'UNKNOWN',
            },
            { status: 500 }
          );
        }
      } else {
        articleId = newArticle.id;
      }
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

