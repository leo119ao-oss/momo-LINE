import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const contact = String(form.get("contact") || "");
  const file = form.get("file") as File | null;
  if (!contact || !file) return new Response("bad request", {status:400});

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // participants 解決
  const { data: p } = await sb.from("participants").select("id").eq("contact", contact).single();
  if (!p) return new Response("participant not found", {status:422});

  const buf = Buffer.from(await file.arrayBuffer());
  const path = `media/${p.id}/${Date.now()}_${file.name}`;
  const { data: put, error: perr } = await sb.storage.from("public").upload(path, buf, { upsert:true, contentType:file.type });
  if (perr) return new Response(perr.message, {status:500});
  const { data: pub } = sb.storage.from("public").getPublicUrl(path);

  // 候補（仮）：後でOpenAIキャプションに差し替え
  const suggested = [ "今日のハイライト", "助かったことに感謝", "来週の一手" ];

  const { data: ins, error: ierr } = await sb.from("media_entries").insert({
    user_id: p.id, storage_path: put?.path, public_url: pub.publicUrl, ask_stage:"suggest", suggested_caption: suggested
  }).select().single();
  if (ierr) return new Response(ierr.message, {status:500});

  return Response.json({ ok:true, entry_id: ins.id, public_url: pub.publicUrl, suggested });
}
