import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const saveSchema = z.object({
  article_id: z.string().uuid(),
  title: z.string().optional(),
  body: z.string(),
  word_count: z.number().int().min(0),
  status: z.enum(['draft', 'submitted']),
});

export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json();
    const { article_id, title, body, word_count, status } = saveSchema.parse(requestBody);

    // 文章解析（gpt-5.1）- 保存前に文章の品質をチェック
    let analyzedBody = body;
    if (body && body.trim().length > 0 && status === 'submitted') {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-5.1',
          messages: [
            {
              role: 'system',
              content: 'あなたは文章の品質を向上させるAIです。提供された文章を読みやすく、自然な日本語に整えてください。内容は変更せず、表現だけを改善してください。',
            },
            {
              role: 'user',
              content: `以下の文章を読みやすく整えてください：\n\n${body}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });
        analyzedBody = completion.choices[0]?.message?.content?.trim() || body;
      } catch (error) {
        console.error('[COACH_SAVE] AI analysis error:', error);
        // エラーが発生しても元の文章を使用
      }
    }

    const updateData: any = {
      body: analyzedBody,
      word_count,
      status,
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) {
      updateData.title = title || null;
    }

    if (status === 'submitted') {
      updateData.submitted_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from('articles')
      .update(updateData)
      .eq('id', article_id);

    if (error) {
      console.error('[COACH_SAVE] Update error:', error);
      return NextResponse.json(
        { error: '記事の保存に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
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

    console.error('[COACH_SAVE] Error:', error);
    return NextResponse.json(
      { error: '記事の保存に失敗しました' },
      { status: 500 }
    );
  }
}

