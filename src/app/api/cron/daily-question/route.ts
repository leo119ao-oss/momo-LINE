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

// 小さな問いのリスト
const dailyQuestions = [
  "こんにちは。今日、お子さんの頬ってどんな手触りでした？ ふわふわ？ それとも、もちもち？",
  "お昼ごはん、何を食べましたか？ その中で、一番『美味しい』と感じた一口はどんな味でした？",
  "今日の空の色、覚えてますか？ もし色鉛筆で塗るとしたら、何色を選びますか？",
  "さっき聞こえた音、何か心に残っていますか？ 子どもの笑い声？ それとも、遠くの救急車の音？",
  "今日、何かホッと一息つけた瞬間はありましたか？ 具体的にどんな時でした？",
  "お子さんの今日の寝顔、どんな表情でしたか？",
  "今日見かけた景色の中で、一番きれいだなと思ったものは何ですか？"
];

// ランダムに質問を選ぶ関数
function getRandomQuestion(): string {
  const randomIndex = Math.floor(Math.random() * dailyQuestions.length);
  return dailyQuestions[randomIndex];
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

    // ランダムに質問を選ぶ
    const selectedQuestion = getRandomQuestion();

    // 各ユーザーにメッセージを送信
    const results = [];
    for (const user of users) {
      try {
        await lineClient.pushMessage(user.line_user_id, {
          type: 'text',
          text: selectedQuestion,
        });

        results.push({ userId: user.line_user_id, status: 'success' });
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error sending message to ${user.line_user_id}:`, error.message);
          results.push({ userId: user.line_user_id, status: 'error', error: error.message });
        } else {
          console.error(`An unknown error occurred for ${user.line_user_id}:`, error);
          results.push({ userId: user.line_user_id, status: 'error', error: 'Unknown error' });
        }
      }
    }

    return NextResponse.json({
      message: 'Daily questions sent successfully.',
      question: selectedQuestion,
      results: results,
      totalSent: results.filter(r => r.status === 'success').length,
      totalErrors: results.filter(r => r.status === 'error').length,
    });

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error in daily question cron job:', error.message);
    } else {
      console.error('An unknown error occurred in daily question cron job:', error);
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
