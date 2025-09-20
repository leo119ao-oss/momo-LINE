import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { participantId, mode } = await req.json(); // 'ephemeral' | 'save'
    
    if (!participantId || !['ephemeral','save'].includes(mode)) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    
    const { error } = await supabaseAdmin
      .from('participants')
      .update({ consent_mode: mode })
      .eq('id', participantId);
      
    if (error) {
      console.error('[CONSENT_SET]', error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[CONSENT_SET] Unexpected error:', error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
