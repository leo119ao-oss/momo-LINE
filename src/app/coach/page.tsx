import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ user_id?: string }> | { user_id?: string };
}) {
  const params = await Promise.resolve(searchParams);
  const userId = params?.user_id;
  
  // /actionページにリダイレクト（user_idパラメータを保持）
  if (userId) {
    redirect(`/action?user_id=${userId}`);
  } else {
    redirect('/action');
  }
}

