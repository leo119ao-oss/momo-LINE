import { supabaseAdmin } from "./supabaseAdmin";

const IDLE_MIN = Number(process.env.SESSION_IDLE_MINUTES ?? 10);

export async function getOrStartSession(participantId: string) {
  // 直近の未終了セッションを取得
  const { data: rows } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("participant_id", participantId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  const now = new Date();
  const latest = rows?.[0];

  if (latest) {
    const last = new Date(latest.last_interaction_at);
    const diffMin = (now.getTime() - last.getTime()) / 1000 / 60;
    if (diffMin <= IDLE_MIN) {
      await supabaseAdmin.from("sessions").update({ last_interaction_at: now.toISOString() }).eq("id", latest.id);
      return { session: latest, isNew: false };
    }
    // タイムアウト -> 終了し、新規開始
    await supabaseAdmin.from("sessions").update({ ended_at: now.toISOString() }).eq("id", latest.id);
  }

  const { data: created } = await supabaseAdmin
    .from("sessions")
    .insert({ participant_id: participantId })
    .select()
    .single();

  return { session: created, isNew: true };
}

export async function endSession(sessionId: string) {
  const now = new Date().toISOString();
  await supabaseAdmin.from("sessions").update({ ended_at: now }).eq("id", sessionId);
}

export function emotionToKey(emoji: string): string | null {
  // クイックリプライの data/postback で渡すキー名を統一
  const map: Record<string,string> = {
    "😊": "smile",
    "😐": "neutral",
    "😩": "tired",
    "😡": "anger",
    "😢": "sad",
    "🤔": "think"
  };
  return map[emoji] ?? null;
}
