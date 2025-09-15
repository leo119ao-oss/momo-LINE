import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(_: NextRequest, { params }: { params: { phase: string } }) {
  try {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const body = await _.json(); // { user_id, answers, minutes }
    
    const { error } = await sb.from("surveys").insert({
      user_id: body.user_id, 
      phase: params.phase, 
      answers: body.answers, 
      minutes: body.minutes ?? 3
    });
    
    if (error) return new Response(error.message, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
