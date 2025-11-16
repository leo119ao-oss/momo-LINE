import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ActionPage({
  searchParams,
}: {
  searchParams: { user_id?: string };
}) {
  const userId = searchParams?.user_id;
  
  // /dailyページにリダイレクト（user_idパラメータを保持）
  if (userId) {
    redirect(`/daily?user_id=${userId}`);
  } else {
    redirect('/daily');
  }
}

