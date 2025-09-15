import { createClient } from "@supabase/supabase-js";

export async function resolveParticipantId(contact: string) {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("participants").select("id").eq("contact", contact).limit(1).maybeSingle();
  return data?.id ?? null;
}
