import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { participantId, date, emotion, summary, insight } = await req.json();

    if (!participantId || !date) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("diary_entries").insert({
      participant_id: participantId,
      date,
      emotion: emotion ?? null,
      summary: summary ?? null,
      insight: insight ?? null,
      visibility: "private"
    });

    if (error) {
      console.error('[DIARY_CREATE]', error);
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DIARY_CREATE] Unexpected error:', error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
