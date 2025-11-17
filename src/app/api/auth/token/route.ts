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
      console.error('[AUTH_TOKEN] Token insert error:', JSON.stringify(insertError, null, 2));
      console.error('[AUTH_TOKEN] Insert data:', { token, user_id, expires_at: expiresAt.toISOString() });
      
      // テーブルが存在しない場合のエラー
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        console.error('[AUTH_TOKEN] Tokens table does not exist. Please run create_tokens_table.sql in Supabase.');
        return NextResponse.json(
          { 
            error: 'Tokens table does not exist',
            details: 'Please create the tokens table in Supabase using create_tokens_table.sql',
            code: 'TABLE_NOT_FOUND'
          },
          { status: 500 }
        );
      }
      
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
          console.error('[AUTH_TOKEN] Retry insert error:', JSON.stringify(retryError, null, 2));
          throw retryError;
        }

        return NextResponse.json({
          ok: true,
          token: retryToken,
          expires_in: TOKEN_EXPIRY_MS / 1000, // 秒単位
        });
      }
      
      // その他のエラー
      return NextResponse.json(
        {
          error: 'トークンの生成に失敗しました',
          details: insertError.message || 'Unknown error',
          code: insertError.code || 'UNKNOWN',
        },
        { status: 500 }
      );
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
    console.error('[AUTH_TOKEN] Error details:', JSON.stringify(error, null, 2));
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'トークンの生成に失敗しました',
        details: errorMessage,
        code: errorCode,
      },
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

    if (fetchError) {
      console.error('[AUTH_TOKEN] Token fetch error:', JSON.stringify(fetchError, null, 2));
      console.error('[AUTH_TOKEN] Token searched:', token);
      
      // テーブルが存在しない場合のエラー
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Tokens table does not exist',
            details: 'Please create the tokens table in Supabase using create_tokens_table.sql',
            code: 'TABLE_NOT_FOUND'
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Invalid or expired token',
          details: fetchError.message || 'Token not found',
          code: fetchError.code || 'TOKEN_NOT_FOUND'
        },
        { status: 401 }
      );
    }
    
    if (!tokenData) {
      console.error('[AUTH_TOKEN] Token data is null for token:', token);
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
    console.error('[AUTH_TOKEN] Error details:', JSON.stringify(error, null, 2));
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'トークンの検証に失敗しました',
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}

