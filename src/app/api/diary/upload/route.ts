import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
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

  // 文章補正（gpt-5.1）- キャプション候補を生成
  let suggested = [ "今日のハイライト", "助かったことに感謝", "来週の一手" ];
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: 'あなたは日記のキャプションを生成するAIです。画像を見て、母親の日常を表現する自然な日本語のキャプション候補を3つ生成してください。15-18文字程度で、温かみのある表現にしてください。',
        },
        {
          role: 'user',
          content: `この画像に適した日記のキャプション候補を3つ生成してください。画像URL: ${pub.publicUrl}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    const captionText = completion.choices[0]?.message?.content?.trim() || '';
    // キャプションを配列に分割（改行や番号で区切られている場合）
    suggested = captionText.split(/\n+/).map(line => line.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean).slice(0, 3);
    if (suggested.length === 0) {
      suggested = [ "今日のハイライト", "助かったことに感謝", "来週の一手" ];
    }
  } catch (error) {
    console.error('[DIARY_UPLOAD] AI caption generation error:', error);
    // エラーが発生してもデフォルトの候補を使用
  }

  const { data: ins, error: ierr } = await sb.from("media_entries").insert({
    user_id: p.id, storage_path: put?.path, public_url: pub.publicUrl, ask_stage:"suggest", suggested_caption: suggested
  }).select().single();
  if (ierr) return new Response(ierr.message, {status:500});

  return Response.json({ ok:true, entry_id: ins.id, public_url: pub.publicUrl, suggested });
}
