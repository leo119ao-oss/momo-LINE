import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
function slugify(s:string){ return s.toLowerCase().replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\w]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""); }

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { entry_id, title, extra_note } = await req.json();
  if (!entry_id || !title) return new Response("bad request", {status:400});
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const slug = `${Date.now()}-${slugify(title).slice(0,30)}`;
  const { error } = await sb.from("media_entries").update({
    title, extra_note, ask_stage:"finalized", page_slug: slug
  }).eq("id", entry_id).select().single();
  if (error) return new Response(error.message, {status:500});
  return Response.json({ ok:true, slug, url:`/diary/${slug}` });
}
