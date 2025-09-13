import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import 'dotenv/config'; // .env.localを読み込むため

// JSDocコメント: HTMLタグを削除する簡単なサニタイズ関数
const sanitizeHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();

// JSDocコメント: テキストを適切な長さのチャンクに分割する関数
const chunkText = (text: string, chunkSize = 500): string[] => {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
};

// JSDocコメント: メインの実行関数
async function main() {
  console.log('Starting article embedding process...');

  // 1. クライアントの初期化
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
    throw new Error('Required environment variables are not set!');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // 2. WordPressから記事データを取得（全記事をページネーションで取得）
  console.log('Fetching all articles from okaasan.net...');
  
  let allPosts: any[] = [];
  let page = 1;
  let hasMorePages = true;
  
  while (hasMorePages) {
    console.log(`Fetching page ${page}...`);
    const response = await fetch(`https://www.okaasan.net/wp-json/wp/v2/posts?per_page=100&page=${page}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }
    
    const posts: any[] = await response.json();
    allPosts = allPosts.concat(posts);
    
    console.log(`Fetched ${posts.length} articles from page ${page}. Total so far: ${allPosts.length}`);
    
    // 100件未満の場合は最後のページ
    hasMorePages = posts.length === 100;
    page++;
    
    // APIレート制限を避けるため少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`Total articles fetched: ${allPosts.length}`);

  // 3. 各記事を処理してベクトル化し、DBに保存
  for (const post of allPosts) {
    const title = sanitizeHtml(post.title.rendered);
    const content = sanitizeHtml(post.content.rendered);
    const url = post.link;

    console.log(`\nProcessing article: "${title}"`);

    const contentChunks = chunkText(content).map((txt, idx) => ({ txt, idx }));
    const BATCH = 50;
    
    for (let i = 0; i < contentChunks.length; i += BATCH) {
      const batch = contentChunks.slice(i, i + BATCH).filter(b => b.txt.length >= 50);

      if (batch.length === 0) continue;

      // OpenAI Embedding APIでベクトル化（バッチ処理）
      const emb = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch.map(b => b.txt),
      });

      const rows = batch.map((b, j) => ({
        content: b.txt,
        source_url: url,
        chunk_idx: b.idx,
        embedding: emb.data[j].embedding,
      }));

      // Supabaseにupsert（重複時は更新）
      const { error } = await supabase
        .from('documents')
        .upsert(rows, { onConflict: 'source_url,chunk_idx' });

      if (error) {
        console.error('upsert error', error);
      } else {
        console.log(` -> Stored batch: ${batch.length} chunks`);
      }
    }
  }

  console.log('\nEmbedding process completed! ✨');
}

main().catch(console.error);
