import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/lineClient';
import { supabase } from '@/lib/supabaseClient';

function verifyCronSecret(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: users, error: usersErr } = await supabase
    .from('participants')
    .select('id, line_user_id');

  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });
  if (!users?.length) return NextResponse.json({ message: 'No participants' });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const results: any[] = [];

  for (const u of users) {
    const { data: logs } = await supabase
      .from('chat_logs')
      .select('role, content, created_at')
      .eq('participant_id', u.id)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    const summary = (logs?.length ?? 0) > 0
      ? `今週のふりかえり（β）
- よく出た気持ち: …
- 印象的な出来事: …
- 来週ためしたいこと: …
※自動生成の簡易版です。`
      : '今週の記録は見当たりませんでした。来週も無理なく少しずつ✍️';

    try {
      await lineClient.pushMessage(u.line_user_id, { type: 'text', text: summary });
      results.push({ userId: u.line_user_id, status: 'success' });
    } catch (e: any) {
      await supabase.from('line_push_errors').insert({
        line_user_id: u.line_user_id,
        payload: { text: summary },
        error: e?.message ?? String(e)
      });
      results.push({ userId: u.line_user_id, status: 'error', error: e?.message ?? String(e) });
    }
  }

  return NextResponse.json({ sent: results.filter(r => r.status === 'success').length, errors: results.filter(r => r.status === 'error') });
}