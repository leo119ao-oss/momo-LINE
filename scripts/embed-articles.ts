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

  // 2. WordPressから記事データを取得
  console.log('Fetching articles from okaasan.net...');
  // per_page=100で最大100件取得します。全件取得する場合はページネーション処理が必要です。
  const response = await fetch('https://www.okaasan.net/wp-json/wp/v2/posts?per_page=10'); // まずは10件でテスト
  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.statusText}`);
  }
  const posts: any[] = await response.json();
  console.log(`Fetched ${posts.length} articles.`);

  // 3. 各記事を処理してベクトル化し、DBに保存
  for (const post of posts) {
    const title = sanitizeHtml(post.title.rendered);
    const content = sanitizeHtml(post.content.rendered);
    const url = post.link;

    console.log(`\nProcessing article: "${title}"`);

    const contentChunks = chunkText(content);

    for (const chunk of contentChunks) {
      if (chunk.length < 50) continue; // 短すぎるチャンクは無視

      // OpenAI Embedding APIでベクトル化
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
      });

      const [embedding] = embeddingResponse.data;

      // Supabaseに保存
      const { error } = await supabase.from('documents').insert({
        content: chunk,
        source_url: url,
        embedding: embedding.embedding,
      });

      if (error) {
        console.error('Error inserting document:', error);
      } else {
        console.log(` -> Stored chunk: "${chunk.substring(0, 40)}..."`);
      }
    }
  }

  console.log('\nEmbedding process completed! ✨');
}

main().catch(console.error);
