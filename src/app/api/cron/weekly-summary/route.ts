import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/lineClient';
import { supabase } from '@/lib/supabaseClient';

// 認証用のヘッダーをチェック
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('CRON_SECRET is not set');
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

// 一週間のユーザーメッセージを取得
async function getWeeklyUserMessages(lineUserId: string): Promise<string[]> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: messages, error } = await supabase
    .from('messages')
    .select('content')
    .eq('line_user_id', lineUserId)
    .eq('role', 'user')
    .gte('created_at', oneWeekAgo.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching user messages:', error);
    return [];
  }

  return (messages || []).map(msg => msg.content);
}

// 週間まとめメッセージを生成
function generateWeeklySummaryMessage(userMessages: string[]): string {
  if (userMessages.length === 0) {
    return `Momoです。今週もお疲れさまでした。
今週はまだお話ししていませんね。

もし今、ペンを持って日記に一行だけ残すとしたら、どの思い出を書き留めておきたいですか？`;
  }

  // 最大3つのメッセージを選択
  const selectedMessages = userMessages.slice(-3);
  
  const messageList = selectedMessages
    .map(msg => `・「${msg}」`)
    .join('\n');

  return `Momoです。今週もお疲れさまでした。
今週、こんな素敵なカケラが集まりましたよ。
${messageList}

もし今、ペンを持って日記に一行だけ残すとしたら、どの思い出を書き留めておきたいですか？`;
}

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabaseのusersテーブルから全ユーザーを取得
    const { data: users, error } = await supabase
      .from('users')
      .select('line_user_id');

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users found' }, { status: 200 });
    }

    // 各ユーザーに個別の週間まとめを送信
    const results = [];
    for (const user of users) {
      try {
        // 一週間のユーザーメッセージを取得
        const userMessages = await getWeeklyUserMessages(user.line_user_id);
        
        // 週間まとめメッセージを生成
        const weeklySummaryMessage = generateWeeklySummaryMessage(userMessages);

        // メッセージを送信
        await lineClient.pushMessage(user.line_user_id, {
          type: 'text',
          text: weeklySummaryMessage,
        });

        results.push({ 
          userId: user.line_user_id, 
          status: 'success',
          messageCount: userMessages.length
        });
      } catch (error) {
        console.error(`Error sending weekly summary to ${user.line_user_id}:`, error);
        results.push({ 
          userId: user.line_user_id, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    return NextResponse.json({
      message: 'Weekly summaries sent successfully',
      results: results,
      totalSent: results.filter(r => r.status === 'success').length,
      totalErrors: results.filter(r => r.status === 'error').length,
    });

  } catch (error) {
    console.error('Error in weekly summary cron job:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
