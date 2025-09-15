import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveParticipantId } from "@/lib/participants";

export async function POST(req: NextRequest) {
  try {
    const { user_id, kind, contact, note } = await req.json();
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // LINE userIdからparticipant IDを解決
    const participantId = await resolveParticipantId(user_id);
    if (!participantId) {
      return new Response("Participant not found", { status: 404 });
    }
    
    const { error } = await sb.from("waitlist").insert({ 
      user_id: participantId, 
      kind, 
      contact, 
      note 
    });
    
    if (error) return new Response(error.message, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
