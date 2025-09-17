import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logQuizAction } from "@/lib/quiz";

interface PageProps {
  searchParams: {
    quizId?: string;
    picked?: string;
  };
}

export default async function ReadPage({ searchParams }: PageProps) {
  const { quizId, picked } = searchParams;

  if (!quizId) {
    redirect('https://www.okaasan.net');
  }

  try {
    // クイズ情報を取得
    const { data: quiz } = await supabaseAdmin
      .from('quiz_master')
      .select('*')
      .eq('id', parseInt(quizId))
      .single();

    if (!quiz) {
      redirect('https://www.okaasan.net');
    }

    // ユーザー特定（簡易版 - 実際はLINEのユーザーIDから特定）
    // 今回は匿名でログを記録
    const participantId = 'anonymous'; // 実際の実装ではLINEユーザーIDから特定

    // ログ記録
    if (picked !== undefined) {
      // 選択肢をタップした場合
      const choiceIndex = parseInt(picked);
      await logQuizAction(participantId, parseInt(quizId), 'tap_choice', choiceIndex, quiz.article_url);
    } else {
      // 記事ボタンを直接タップした場合
      await logQuizAction(participantId, parseInt(quizId), 'open', undefined, quiz.article_url);
    }

    // 記事URLへリダイレクト
    redirect(quiz.article_url);

  } catch (error) {
    console.error('Read page error:', error);
    redirect('https://www.okaasan.net');
  }
}
