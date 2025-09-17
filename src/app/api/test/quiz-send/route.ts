import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/lineClient';
import { generateShortHook, buildTeaserFlex, logQuizAction } from '@/lib/quiz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quizId, testUserIds } = body;

    if (!quizId) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
    }

    // クイズ情報を取得
    const { data: quiz, error } = await supabaseAdmin
      .from('quiz_master')
      .select('*')
      .eq('id', quizId)
      .single();

    if (error || !quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // 短いフック文を生成
    const shortHook = await generateShortHook(quiz.question);

    // テストユーザーIDを取得（指定がない場合は全てのユーザー）
    let userIds: string[] = [];
    
    if (testUserIds && Array.isArray(testUserIds)) {
      userIds = testUserIds;
    } else {
      // 全てのユーザーを取得
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('line_user_id')
        .limit(10); // テスト用に10人まで
      
      userIds = users?.map(u => u.line_user_id) || [];
    }

    const results: any[] = [];

    for (const userId of userIds) {
      try {
        // 1通目：通知用テキスト
        await lineClient.pushMessage(userId, {
          type: "text",
          text: `【朝の1分】${shortHook}（3択・30秒）`
        });

        // 2通目：Flexメッセージ
        await lineClient.pushMessage(userId, buildTeaserFlex(quiz));

        // ログ記録（sent）
        await logQuizAction(userId, quizId, 'sent', undefined, quiz.article_url);

        results.push({ ok: userId });
      } catch (error) {
        console.error(`Failed to send quiz to ${userId}:`, error);
        results.push({ ng: userId, error: String(error) });
      }
    }

    return NextResponse.json({ 
      success: true,
      sent: results.filter(r => r.ok).length,
      total: results.length,
      quiz_id: quizId,
      results 
    });

  } catch (error) {
    console.error('Quiz send test error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
