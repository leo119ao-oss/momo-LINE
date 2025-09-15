import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // {display_name, contact, cohort}
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // 公平割付（簡易：交互）
    const { data: counts } = await sb.rpc("count_by_condition"); // 任意: ない場合は下で代替ロジック
    const condition = (counts?.minimal ?? 0) <= (counts?.extended ?? 0) ? "minimal" : "extended";
    
    const { data, error } = await sb.from("participants").insert({
      display_name: body.display_name,
      contact: body.contact,
      cohort: body.cohort ?? "community",
      condition,
      consented_at: new Date().toISOString()
    }).select().single();
    
    if (error) return new Response(error.message, { status: 400 });
    return Response.json({ ok: true, participant: { id: data.id, condition } });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
