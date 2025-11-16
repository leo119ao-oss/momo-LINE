import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

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

    const updateData: any = {
      body,
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

