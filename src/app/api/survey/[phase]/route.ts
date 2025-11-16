import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(_: NextRequest, { params }: { params: { phase: string } }) {
  try {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const body = await _.json(); // { user_id, answers, minutes }
    
    // 要点抽出（gpt-4.1）- 回答から要点を抽出
    let summary = null;
    if (body.answers && typeof body.answers === 'object') {
      try {
        const answersText = JSON.stringify(body.answers, null, 2);
        const completion = await openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: 'あなたは調査回答から要点を抽出するAIです。提供された回答から重要なポイントを簡潔にまとめてください。',
            },
            {
              role: 'user',
              content: `以下の調査回答から要点を抽出してください：\n\n${answersText}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });
        summary = completion.choices[0]?.message?.content?.trim() || null;
      } catch (error) {
        console.error('[SURVEY] AI summary generation error:', error);
      }
    }
    
    const { error } = await sb.from("surveys").insert({
      user_id: body.user_id, 
      phase: params.phase, 
      answers: body.answers, 
      minutes: body.minutes ?? 3,
      summary: summary,
    });
    
    if (error) return new Response(error.message, { status: 400 });
    return Response.json({ ok: true, summary });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
