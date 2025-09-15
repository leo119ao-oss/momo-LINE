"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from '@supabase/supabase-js';
import { ensureLiff } from "@/lib/liffClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DiaryPage({ params }: { params: { slug: string } }) {
  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_DIARY_ID || '2008112810-qaB8YQdO';
        console.log(`[DIARY] LIFF ID: ${liffId}`);
        await ensureLiff(liffId);
        
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data } = await supabase
          .from('media_entries')
          .select('*')
          .eq('page_slug', params.slug)
          .maybeSingle();

        if (!data) {
          notFound();
        }
        
        setEntry(data);
        setLoading(false);
      } catch (error) {
        console.error('[DIARY] LIFF initialization error:', error);
        setLoading(false);
      }
    })();
  }, [params.slug]);

  if (loading) {
    return <div className="p-4 text-sm">読み込み中...</div>;
  }

  if (!entry) {
    notFound();
  }

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
