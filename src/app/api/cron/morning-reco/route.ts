import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { lineClient } from '@/lib/lineClient';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function ok(req: NextRequest){ 
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest){
  if(!ok(req)) return NextResponse.json({error:'Unauthorized'},{status:401});
  
  // 対象ユーザ取得（重複送信防止）
  const { data: users } = await supabaseAdmin.from('users').select('line_user_id, participants!inner(id,last_morning_sent_at)').limit(5000);
  const { data: qblobs } = await supabaseAdmin.from('recent_user_queries').select('*');

  const blobMap = new Map(qblobs?.map(r => [r.participant_id, r.query_blob || '']));
  const results:any[]=[];
  
  for(const u of users||[]){ 
    try{
      const pid = u.participants[0].id;
      // 1記事推薦（ベクトルRAG）
      const query = (blobMap.get(pid) || '子育て 雑記 内省 生活 家族').slice(0, 800);
      const emb = await openai.embeddings.create({ 
        model:'text-embedding-3-small', 
        input: query 
      });
      const { data: docs } = await supabaseAdmin.rpc('match_documents_arr', { 
        query_embedding: emb.data[0].embedding, 
        match_count: 5 
      });
      const picked = (docs||[]).slice(0,1);
      if(!picked.length) continue;

      // 要約＋今日の一言
      const sys = 'あなたは優しい編集者。記事の要点を3行で要約し、最後に「今日は〜を意識してみる？」の1行を添える。箇条書きは「・」。Markdown装飾は禁止。';
      const art = picked[0];
      const prompt = `記事抜粋:\n${art.content.slice(0,1200)}\nURL:${art.source_url}`;
      const c = await openai.chat.completions.create({
        model:'gpt-4o-mini', 
        temperature:0.3,
        messages:[{role:'system',content:sys},{role:'user',content:prompt}]
      });
      const body = c.choices[0].message.content?.trim() || '';
      
      await lineClient.pushMessage(u.line_user_id, {
        type:'text',
        text: `おはよう。\n今日のおすすめだよ。\n\n${body}\n\n${art.source_url}`
      });
      
      await supabaseAdmin.from('participants').update({ 
        last_morning_sent_at: new Date().toISOString() 
      }).eq('id', pid);
      
      results.push({ok:u.line_user_id});
    }catch(e){ 
      results.push({ng:u?.line_user_id, e: String(e)});
    }
  }
  
  return NextResponse.json({sent: results.length, results});
}
