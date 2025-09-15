import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lineClient } from '@/lib/lineClient';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 認証
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // 参加者＆最近の発話
  const { data: users } = await supabaseAdmin.from('users')
    .select('line_user_id, participants!inner(id)');
  const { data: qblobs } = await supabaseAdmin.from('recent_user_queries').select('*');
  const blob = new Map(qblobs?.map(r => [r.participant_id, r.query_blob || '']));

  let sent = 0;
  for (const u of users || []) {
    try {
      const pid = (u.participants as any).id;
      const query = (blob.get(pid) || '子育て 内省 生活 家族').slice(0, 800);
      const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
      const { data: docs } = await supabaseAdmin.rpc('match_documents_arr', {
        query_embedding: emb.data[0].embedding, match_count: 5
      });
      const art = (docs || [])[0];
      if (!art) continue;

      const sys = '優しい編集者。記事の要点を3行で要約し、最後に「今日は〜を意識してみる？」の1行。装飾禁止。箇条書きは「・」。';
      const prompt = `抜粋:\n${(art.content || '').slice(0,1200)}\nURL:${art.source_url}`;
      const c = await openai.chat.completions.create({
        model: 'gpt-4o-mini', temperature: 0.3,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }]
      });

      const msg = c.choices[0].message.content?.trim() || '';
      await lineClient.pushMessage(u.line_user_id, {
        type: 'text',
        text: `おはよう。\n今日のおすすめだよ。\n\n${msg}\n\n${art.source_url}`
      });
      sent++;
    } catch (e) {
      console.error('morning-reco error', e);
    }
  }
  return NextResponse.json({ sent });
}
