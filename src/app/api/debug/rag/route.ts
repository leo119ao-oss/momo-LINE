import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildReferenceBlock } from '@/lib/momoLogic';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') || '子育て イライラ 解消 コツ';
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const emb = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: q
  });

  const { data, error } = await supabaseAdmin.rpc('match_documents_arr', {
    query_embedding: emb.data[0].embedding, match_count: 8
  });

  // 参考記事ブロック生成のテスト
  let referenceBlock = '';
  if (data && data.length > 0) {
    try {
      const picked = data.slice(0, 3);
      referenceBlock = await buildReferenceBlock(q, picked);
    } catch (e) {
      referenceBlock = `Error generating reference block: ${e}`;
    }
  }

  return NextResponse.json({
    q, error,
    hits: data?.map((d:any) => ({ id: d.id, sim: d.similarity, url: d.source_url, preview: d.content.slice(0,80) })),
    referenceBlock
  });
}
