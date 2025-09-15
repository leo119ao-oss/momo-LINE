import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest){
  const q = new URL(req.url).searchParams.get('q') || '';
  const key = process.env.GOOGLE_API_KEY!;
  const cx  = process.env.GOOGLE_CSE_ID!;
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(q)}&num=5&lr=lang_ja`;
  const r = await fetch(url); 
  const j = await r.json();
  const items = (j.items || []).map((it:any)=>({ 
    title: it.title, 
    snippet: it.snippet, 
    link: it.link 
  }));
  return NextResponse.json({ items });
}
