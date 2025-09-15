// src/lib/wpMeta.ts

export async function fetchWpMeta(url: string): Promise<{title?: string|null; author?: string|null}> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const html = await res.text();
    const t = /<meta property="og:title" content="([^"]+)"/i.exec(html)?.[1]
           || /<title>([^<]+)<\/title>/i.exec(html)?.[1];
    const a = /<meta name="author" content="([^"]+)"/i.exec(html)?.[1] ?? null;
    return { title: t ?? null, author: a };
  } catch { return {}; }
}
