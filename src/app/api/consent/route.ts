import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // {display_name, contact, cohort}
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // 文面生成（gpt-4.1）- 研究同意文面を生成
    let consentText = null;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'あなたは研究同意文面を生成するAIです。母親コミュニティの研究参加に関する同意文面を、わかりやすく、親しみやすい日本語で生成してください。',
          },
          {
            role: 'user',
            content: '研究参加に関する同意文面を生成してください。研究期間、目的、参加者の権利について説明してください。',
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });
      consentText = completion.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('[CONSENT] AI consent text generation error:', error);
    }
    
    // 公平割付（簡易：交互）
    const { data: counts } = await sb.rpc("count_by_condition"); // 任意: ない場合は下で代替ロジック
    const condition = (counts?.minimal ?? 0) <= (counts?.extended ?? 0) ? "minimal" : "extended";
    
    const { data, error } = await sb.from("participants").insert({
      display_name: body.display_name,
      contact: body.contact,
      cohort: body.cohort ?? "community",
      condition,
      consented_at: new Date().toISOString(),
      consent_text: consentText,
    }).select().single();
    
    if (error) return new Response(error.message, { status: 400 });
    return Response.json({ ok: true, participant: { id: data.id, condition }, consent_text: consentText });
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }
}
