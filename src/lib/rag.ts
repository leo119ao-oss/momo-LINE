// src/lib/rag.ts
export type RagHit = {
  id: string;
  url: string;
  title?: string | null;
  author?: string | null;
  chunk: string;
  score: number; // cosine similarity
  keywords?: string[];
};

export const RAG_TOP_K = 3;
export const RAG_MIN_SIM = 0.45;

// 主要語抽出（簡易）: ひらがな・助詞を除去して上位数語
export function extractKeyTerms(text: string, n = 6): string[] {
  const norm = (text || "")
    .toLowerCase()
    .replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1Fa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
  const stop = new Set(["の","が","に","を","と","は","へ","で","も","から","まで","より","や","な","だ","です","ます"]);
  const tokens = norm.split(" ").filter(t => t && !stop.has(t as any));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0, n).map(([w])=>w);
}

// 二次フィルタ：ヒットのkeywordsに主要語が少なくとも1語含まれる
export function secondStageFilter(hits: RagHit[], keyTerms: string[]): RagHit[] {
  const key = new Set(keyTerms);
  return hits.filter(h => (h.keywords ?? extractKeyTerms(h.chunk)).some(k => key.has(k)));
}

// 1文理由を作る（抽象化短文）
export function oneLineWhy(query: string, hit: RagHit): string {
  const t = hit.title || new URL(hit.url).pathname.split("/").pop() || "関連記事";
  return `「${t}」はあなたの関心「${query}」に直接関連する要点を含みます。`;
}
