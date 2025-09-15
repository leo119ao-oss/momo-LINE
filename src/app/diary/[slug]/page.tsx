import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from '@supabase/supabase-js';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const title = 'Momo 絵日記';
  return { title, description: '今日の小さな一枚' };
}

export default async function DiaryPage({ params }: { params: { slug: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: entry } = await supabase
    .from('media_entries')
    .select('*')
    .eq('page_slug', params.slug)
    .maybeSingle();

  if (!entry) notFound();
  const e = entry;

  return (
    <main className="mx-auto max-w-xl p-4">
      <article className="rounded-2xl border shadow p-4 space-y-3 bg-white">
        <div className="text-sm opacity-70">{new Date(e.created_at).toLocaleDateString("ja-JP")}</div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
          <Image src={e.image_url} alt={e.title ?? ""} fill className="object-cover" />
        </div>
        <h1 className="text-xl font-semibold">{e.title}</h1>
        {e.extra_note && <p className="text-base">{e.extra_note}</p>}
      </article>
    </main>
  );
}
