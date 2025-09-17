import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lineClient } from '@/lib/lineClient';
import { generateQuizFromAutoSearch, generateShortHook, buildTeaserFlex, logQuizAction } from '@/lib/quiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 認証
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 対象ユーザー取得
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('line_user_id, participants!inner(id)')
      .limit(5000);

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No users found' });
    }

    // クイズを自動生成（リトライ機能付き）
    let quiz;
    try {
      quiz = await generateQuizFromAutoSearch();
      if (!quiz) {
        console.error('Quiz generation failed after all retries');
        return NextResponse.json({ 
          error: 'Failed to generate quiz after retries',
          message: 'Please check the logs and try again later'
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Quiz generation error:', error);
      return NextResponse.json({ 
        error: 'Quiz generation failed',
        details: String(error)
      }, { status: 500 });
    }

    // 短いフック文を生成（エラーハンドリング付き）
    let shortHook;
    try {
      shortHook = await generateShortHook(quiz.question);
    } catch (error) {
      console.error('Failed to generate short hook:', error);
      // フォールバック: 質問文の最初の部分を使用
      shortHook = quiz.question.slice(0, 20) + '...';
    }

    const results: any[] = [];
    
    for (const user of users) {
      try {
        const participantId = (user.participants as any).id;
        
        // 1通目：通知用テキスト
        await lineClient.pushMessage(user.line_user_id, {
          type: "text",
          text: `【朝の1分】${shortHook}（3択・30秒）`
        });

        // 2通目：Flexメッセージ
        await lineClient.pushMessage(user.line_user_id, buildTeaserFlex(quiz));

        // ログ記録（sent）
        await logQuizAction(participantId, quiz.id, 'sent', undefined, quiz.article_url);

        results.push({ ok: user.line_user_id });
      } catch (error) {
        console.error(`Failed to send quiz to ${user.line_user_id}:`, error);
        results.push({ ng: user.line_user_id, error: String(error) });
      }
    }

    return NextResponse.json({ 
      sent: results.filter(r => r.ok).length,
      total: results.length,
      quiz_id: quiz.id,
      results 
    });

  } catch (error) {
    console.error('Morning quiz cron error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
