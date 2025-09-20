import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin";

export async function resolveParticipantId(contact: string) {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("participants").select("id").eq("contact", contact).limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function findOrCreateParticipant(lineUserId: string) {
  let { data: participant } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  if (!participant) {
    const { data: newParticipant, error } = await supabaseAdmin
      .from('participants')
      .insert({ line_user_id: lineUserId, archetype: 'B' })
      .select()
      .single();
    
    if (error) throw error;
    participant = newParticipant;
  }
  return participant;
}
