import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lineClient } from '@/lib/lineClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isSundayJST(d = new Date()) {
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst.getDay() === 0; // 0=Sun
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const prompts = [
    '今日はどんな一日だった？心に残った「小さな出来事」を一つだけ思い出してみて？',
    '今日はどんな感情が一番強かった？その瞬間を一言で言うと？',
    '朝のおすすめ、少しでも試せた？やってみてどうだった？'
  ];

  const { data: users } = await supabaseAdmin.from('users')
    .select('line_user_id, participants!inner(id)');

  let sent = 0;
  for (const u of users || []) {
    try {
      const q = prompts[Math.floor(Math.random() * prompts.length)];
      await lineClient.pushMessage(u.line_user_id, {
        type: 'text',
        text: `こんばんは。\n${q}\n（一言でもOK。あとで絵日記にできるよ）`
      });

      // 日曜JSTだけ週次振り返りも追加送信
      if (isSundayJST()) {
        await lineClient.pushMessage(u.line_user_id, {
          type: 'text',
          text: '今週の振り返りもしようか。心に残った出来事を3つ、短くメモしてみて？'
        });
      }
      sent++;
    } catch (e) {
      console.error('evening-journal error', e);
    }
  }
  return NextResponse.json({ sent });
}