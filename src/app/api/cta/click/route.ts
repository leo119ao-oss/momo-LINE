import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { user_id, kind } = await req.json();
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await sb.from("cta_clicks").insert({ 
      user_id, 
      kind, 
      clicked_at: new Date().toISOString() 
    });
    
    if (error) return new Response(error.message, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
