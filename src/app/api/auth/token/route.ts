import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const tokenSchema = z.object({
  user_id: z.string().min(1),
});

// 1日間有効なトークンを生成
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24時間 = 1日

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id } = tokenSchema.parse(body);

    // 古いトークンをクリーンアップ（期限切れのトークンを削除）
    await supabaseAdmin
      .from('tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // 新しいトークンを生成
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // データベースにトークンを保存
    const { error: insertError } = await supabaseAdmin
      .from('tokens')
      .insert({
        token,
        user_id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[AUTH_TOKEN] Token insert error:', insertError);
      // トークンの重複エラーの場合、リトライ
      if (insertError.code === '23505') {
        // トークンが重複した場合、新しいトークンを生成して再試行
        const retryToken = nanoid(32);
        const { error: retryError } = await supabaseAdmin
          .from('tokens')
          .insert({
            token: retryToken,
            user_id,
            expires_at: expiresAt.toISOString(),
          });

        if (retryError) {
          throw retryError;
        }

        return NextResponse.json({
          ok: true,
          token: retryToken,
          expires_in: TOKEN_EXPIRY_MS / 1000, // 秒単位
        });
      }
      throw insertError;
    }

    return NextResponse.json({
      ok: true,
      token,
      expires_in: TOKEN_EXPIRY_MS / 1000, // 秒単位
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

    console.error('[AUTH_TOKEN] Error:', error);
    return NextResponse.json(
      { error: 'トークンの生成に失敗しました' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'token is required' },
        { status: 400 }
      );
    }

    // データベースからトークンを検索
    const { data: tokenData, error: fetchError } = await supabaseAdmin
      .from('tokens')
      .select('user_id, expires_at')
      .eq('token', token)
      .single();

    if (fetchError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // 期限切れチェック
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    if (expiresAt < now) {
      // 期限切れトークンを削除
      await supabaseAdmin
        .from('tokens')
        .delete()
        .eq('token', token);
      
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      user_id: tokenData.user_id,
    });
  } catch (error: any) {
    console.error('[AUTH_TOKEN] Error:', error);
    return NextResponse.json(
      { error: 'トークンの検証に失敗しました' },
      { status: 500 }
    );
  }
}

