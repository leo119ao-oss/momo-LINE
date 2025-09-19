import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/lineClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('[TOKEN_TEST] Testing LINE API token validity...');
    
    // トークンの有効性を確認するために、簡単なAPI呼び出しを実行
    // プロフィール情報の取得を試行（トークンが無効ならエラーになる）
    const testUserId = 'test_user_id'; // 実際のユーザーIDは不要、トークンの有効性のみ確認
    
    try {
      // トークンの有効性を確認するために、LINE APIの認証状態をチェック
      // 実際には存在しないユーザーIDでも、トークンが有効なら認証エラーが返される
      await lineClient.getProfile(testUserId);
    } catch (error: any) {
      // 認証エラー（401）の場合は、トークンが無効
      if (error.status === 401) {
        console.log('[TOKEN_TEST] Token is invalid or expired');
        return NextResponse.json({ 
          status: 'invalid',
          message: 'LINE API token is invalid or expired',
          error: error.message
        });
      }
      
      // その他のエラー（404など）の場合は、トークンは有効だがユーザーが存在しない
      console.log('[TOKEN_TEST] Token is valid, but user not found (expected)');
      return NextResponse.json({ 
        status: 'valid',
        message: 'LINE API token is valid',
        error_type: error.status || 'unknown'
      });
    }

    console.log('[TOKEN_TEST] Token validation completed');
    return NextResponse.json({ 
      status: 'valid',
      message: 'LINE API token appears to be valid'
    });

  } catch (error) {
    console.error('[TOKEN_TEST] Error testing token:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Error testing LINE API token',
      error: String(error)
    }, { status: 500 });
  }
}
