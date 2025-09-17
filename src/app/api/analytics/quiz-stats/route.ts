import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 認証チェック（必要に応じて）
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 期間を指定（デフォルトは過去7日）
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // クイズ統計を取得
    const { data: quizStats } = await supabaseAdmin
      .from('quiz_logs')
      .select('action, created_at, quiz_id')
      .gte('created_at', startDate.toISOString());

    if (!quizStats) {
      return NextResponse.json({ stats: {} });
    }

    // 統計を計算
    const stats = {
      total_sent: quizStats.filter(log => log.action === 'sent').length,
      total_tap_choice: quizStats.filter(log => log.action === 'tap_choice').length,
      total_open: quizStats.filter(log => log.action === 'open').length,
    };

    // 率を計算
    const tap_choice_rate = stats.total_sent > 0 ? (stats.total_tap_choice / stats.total_sent * 100).toFixed(1) : 0;
    const open_rate = stats.total_sent > 0 ? (stats.total_open / stats.total_sent * 100).toFixed(1) : 0;

    // 日別統計
    const dailyStats: any = {};
    quizStats.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, tap_choice: 0, open: 0 };
      }
      dailyStats[date][log.action as keyof typeof dailyStats[string]]++;
    });

    // クイズ別統計
    const quizStatsByQuiz: any = {};
    quizStats.forEach(log => {
      const quizId = log.quiz_id.toString();
      if (!quizStatsByQuiz[quizId]) {
        quizStatsByQuiz[quizId] = { sent: 0, tap_choice: 0, open: 0 };
      }
      quizStatsByQuiz[quizId][log.action as keyof typeof quizStatsByQuiz[string]]++;
    });

    return NextResponse.json({
      period_days: days,
      summary: {
        total_sent: stats.total_sent,
        total_tap_choice: stats.total_tap_choice,
        total_open: stats.total_open,
        tap_choice_rate: parseFloat(tap_choice_rate),
        open_rate: parseFloat(open_rate)
      },
      daily_stats: dailyStats,
      quiz_stats: quizStatsByQuiz
    });

  } catch (error) {
    console.error('Quiz stats error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
