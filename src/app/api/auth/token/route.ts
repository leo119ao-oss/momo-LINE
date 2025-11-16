import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

const tokenSchema = z.object({
  user_id: z.string().min(1),
});

// 簡易的なトークンストア（本番環境ではRedis等を使用すべき）
const tokenStore = new Map<string, { user_id: string; expires_at: number }>();

// 10分間有効なトークンを生成
const TOKEN_EXPIRY_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id } = tokenSchema.parse(body);

    // 古いトークンをクリーンアップ
    const now = Date.now();
    for (const [token, data] of tokenStore.entries()) {
      if (data.expires_at < now) {
        tokenStore.delete(token);
      }
    }

    // 新しいトークンを生成
    const token = nanoid(32);
    tokenStore.set(token, {
      user_id,
      expires_at: now + TOKEN_EXPIRY_MS,
    });

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

    const tokenData = tokenStore.get(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const now = Date.now();
    if (tokenData.expires_at < now) {
      tokenStore.delete(token);
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

