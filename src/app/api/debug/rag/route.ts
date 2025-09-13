import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const q = '子育て イライラ 解消 コツ'; // テスト文

  const emb = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: q
  });

  const { data, error } = await supabaseAdmin.rpc('match_documents_arr', {
    query_embedding: emb.data[0].embedding,
    match_count: 8
  });

  return NextResponse.json({
    error,
    hits: data?.map((d:any) => ({
      id: d.id,
      sim: d.similarity,
      url: d.source_url,
      preview: d.content.slice(0,80)
    }))
  });
}
