import { NextRequest, NextResponse } from 'next/server';
import { lineClient } from '@/lib/lineClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function ok(req: NextRequest){ 
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

const PROMPTS = [
  '今日はどんな一日だった？心に残った「小さな出来事」を一つだけ思い出してみて？',
  '今日はどんな感情が一番強かった？その瞬間を一言で言うと？',
  '朝のおすすめ、少しでも試せた？やってみてどうだった？'
];

export async function GET(req: NextRequest){
  if(!ok(req)) return NextResponse.json({error:'Unauthorized'},{status:401});
  
  const { data: users } = await supabaseAdmin.from('users').select('line_user_id, participants!inner(id,last_evening_sent_at)').limit(5000);
  const q = PROMPTS[Math.floor(Math.random()*PROMPTS.length)];
  const results:any[]=[];
  
  for(const u of users||[]){ 
    try{
      await lineClient.pushMessage(u.line_user_id, { 
        type:'text', 
        text: `こんばんは。\n${q}\n（一言でもOK。あとで絵日記にできるよ）` 
      });
      
      await supabaseAdmin.from('participants').update({ 
        last_evening_sent_at: new Date().toISOString() 
      }).eq('id', u.participants[0].id);
      
      results.push({ok:u.line_user_id});
    }catch(e){ 
      results.push({ng:u.line_user_id, e:String(e)});
    }
  }
  
  return NextResponse.json({sent: results.length, results});
}
