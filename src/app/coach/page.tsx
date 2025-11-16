import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ user_id?: string }> | { user_id?: string };
}) {
  const params = await Promise.resolve(searchParams);
  const userId = params?.user_id;
  
  // /dailyページにリダイレクト（user_idパラメータを保持）
  if (userId) {
    redirect(`/daily?user_id=${userId}`);
  } else {
    redirect('/daily');
  }
}

