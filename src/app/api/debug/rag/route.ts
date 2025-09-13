import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') || '子育て イライラ 解消 コツ';
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const emb = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: q
  });

  const { data, error } = await supabaseAdmin.rpc('match_documents', {
    query_embedding: emb.data[0].embedding, match_count: 8, match_threshold: 0.1
  });

  return NextResponse.json({
    q, error,
    hits: data?.map((d:any) => ({ id: d.id, sim: d.similarity, url: d.source_url, preview: d.content.slice(0,80) }))
  });
}
