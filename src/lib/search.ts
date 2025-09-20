// src/lib/search.ts
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';
import { RAG_TOP_K, RAG_MIN_SIM, secondStageFilter, extractKeyTerms, type RagHit } from './rag';
import { fetchWpMeta } from './wpMeta';
import { logRagMeta } from './log';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// 埋め込み検索の実装
async function embeddingSearch(query: string, options: { topK: number }): Promise<RagHit[]> {
  try {
    console.log('[EMBEDDING] Creating embedding for query:', query);
    
    // クエリの埋め込み生成
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('[EMBEDDING] Embedding created, length:', queryEmbedding.length);

    // Supabase DBから関連情報を検索
    const { data: documents, error } = await supabaseAdmin.rpc('match_documents_arr', {
      query_embedding: queryEmbedding,
      match_count: options.topK,
    });

    if (error) {
      console.error('[EMBEDDING] Supabase RPC error:', error);
      throw new Error(`Supabase search error: ${error.message}`);
    }

    console.log('[EMBEDDING] Documents found:', documents?.length || 0);

    // RagHit形式に変換
    const hits: RagHit[] = (documents ?? []).map((doc: any) => ({
      id: doc.id || '',
      url: doc.source_url || '',
      title: doc.title || null,
      author: doc.author_name || null,
      chunk: doc.content || '',
      score: doc.similarity || 0,
      keywords: extractKeyTerms(doc.content || ''),
    }));

    return hits;
  } catch (error) {
    console.error('[EMBEDDING] Error in embeddingSearch:', error);
    throw error;
  }
}

// WordPressメタの遅延取得
async function enrichWithWpMeta(hits: RagHit[]): Promise<RagHit[]> {
  const enriched = await Promise.all(
    hits.map(async (hit) => {
      if (hit.title && hit.author) return hit; // 既にメタがある場合はスキップ
      
      try {
        const meta = await fetchWpMeta(hit.url);
        logRagMeta(hit.url, !!meta.title, !!meta.author);
        
        return {
          ...hit,
          title: hit.title || meta.title,
          author: hit.author || meta.author,
        };
      } catch {
        logRagMeta(hit.url, false, false);
        return hit;
      }
    })
  );
  
  return enriched;
}

// メイン検索関数
export async function searchArticles(query: string): Promise<RagHit[]> {
  try {
    console.log('[SEARCH] Starting search for query:', query);
    
    const keyTerms = extractKeyTerms(query);
    console.log('[SEARCH] Extracted key terms:', keyTerms);
    
    const rawHits = await embeddingSearch(query, { topK: 12 }); // 一旦広めに取る
    console.log('[SEARCH] Raw hits count:', rawHits.length);
    
    const filteredByScore = rawHits.filter(h => h.score >= RAG_MIN_SIM);
    console.log('[SEARCH] After score filtering:', filteredByScore.length);
    
    const narrowed = secondStageFilter(filteredByScore, keyTerms).slice(0, RAG_TOP_K);
    console.log('[SEARCH] After keyword filtering:', narrowed.length);
    
    // WordPressメタで補完
    const enriched = await enrichWithWpMeta(narrowed);
    console.log('[SEARCH] Final enriched results:', enriched.length);
    
    return enriched;
  } catch (error) {
    console.error('[SEARCH] Error in searchArticles:', error);
    // エラーが発生した場合は空の配列を返す（フォールバック処理を可能にする）
    return [];
  }
}
