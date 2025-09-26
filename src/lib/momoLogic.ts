// import { supabase } from './supabaseClient';
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';
import { findOrCreateParticipant } from './participants';
import { appRev } from './log';


// 対話型AIのシステムプロンプト
const DIALOGUE_AI_SYSTEM = `
あなたはMomo。母親の内省を支える温かい対話相手です。

【役割】
- ユーザーの気持ちを受け止め、共感する
- 深く聞くことで、ユーザー自身の気づきを促す
- 評価や判断はせず、傾聴に徹する
- 対話を通じて、ユーザーの内省を深める

【応答のポイント】
- 感情を認め、受け止める（「疲れているんですね」「うれしい気持ちなんですね」）
- 具体的な質問で深く聞く（「どんなことが一番気になってる？」「どんなことがその気持ちにさせてる？」）
- ユーザーの言葉を繰り返し、確認する（「○○ということですね」）
- 新しい視点を提案する（「○○なものの見方をされるんですね」）
- 対話を促す（「もう少し詳しく教えてもらえる？」）

【避けること】
- 記事の紹介や検索
- アドバイスや解決策の提示
- 評価や判断
- 表面的な同意（「よく分かります」など）

【口調】
- やさしく、温かい
- 共感的で受容的
- 簡潔で読みやすい
- プレーンテキスト（装飾なし）
`.trim();

function cleanForLine(raw: string): string {
  return (raw ?? '')
    // コードブロック除去
    .replace(/```[\s\S]*?```/g, '')
    // 強調(**text** / __text__ / _text_) を素の文に
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 箇条書きの - / * を「・」へ（行頭のみ）
    .replace(/^\s*[-*]\s+/gm, '・')
    // デバッグ印 (β xxxxxxx) を念のため除去
    .replace(/\(β [0-9a-f]{7}\)/ig, '')
    // 余分な空白を整理
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function getSlugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.length ? decodeURIComponent(parts.at(-1)!) : null;
  } catch { return null; }
}

function cleanText(s?: string) {
  if (!s) return '';
  // HTMLタグ除去 + サイト名サフィックスの軽い除去
  return s.replace(/<[^>]*>/g, '').replace(/\s*\|\s*.*$/, '').trim();
}

async function fetchMetaFromOEmbed(url: string) {
  const ep = `https://www.okaasan.net/wp-json/oembed/1.0/embed?url=${encodeURIComponent(url)}`;
  const r = await fetch(ep, { cache: 'no-store' });
  if (!r.ok) return null;
  const j: unknown = await r.json();

  // title を安全に取り出すヘルパー
  function safeTitleFromJson(x: unknown): string | null {
    if (x && typeof x === 'object') {
      const anyx = x as any;
      // パターン1: { title: "..." }
      if (typeof anyx.title === 'string') {
        return cleanText(anyx.title);
      }
      // パターン2: { title: { rendered: "..." } } (WP APIっぽい)
      if (anyx.title && typeof anyx.title === 'object' && typeof anyx.title.rendered === 'string') {
        return cleanText(anyx.title.rendered);
      }
    }
    return null;
  }

  const title = safeTitleFromJson(j);
  const author =
    (j && typeof j === 'object' && 'author_name' in (j as any) && typeof (j as any).author_name === 'string')
      ? (j as any).author_name
      : 'お母さん大学';
  return title ? { title, author_name: author } : null;
}

async function fetchMetaFromPosts(url: string) {
  const base = 'https://www.okaasan.net/wp-json/wp/v2/posts';
  const slug = getSlugFromUrl(url);
  if (slug) {
    const r1 = await fetch(`${base}?slug=${encodeURIComponent(slug)}&_embed=author&per_page=1`);
    if (r1.ok) {
      const arr: any[] = await r1.json();
      const p = (Array.isArray(arr) ? arr[0] : undefined) as any;
      if (p && p.title && typeof p.title.rendered === 'string') {
        return {
          title: cleanText(p.title.rendered),
          author_name: p?._embedded?.author?.[0]?.name || 'お母さん大学',
        };
      }
    }
  }
  // URLでのsearchは精度が落ちるので最後の最後だけ
  const r2 = await fetch(`${base}?search=${encodeURIComponent(url)}&_embed=author&per_page=1`);
  if (r2.ok) {
    const arr: any[] = await r2.json();
    const p = arr?.[0];
    if (p) return {
      title: cleanText(p?.title?.rendered),
      author_name: p?._embedded?.author?.[0]?.name || 'お母さん大学',
    };
  }
  return null;
}

async function fetchTitleFromHtml(url: string) {
  try {
    const html = await (await fetch(url, { cache: 'no-store' })).text();
    const m = html.match(/<title>(.*?)<\/title>/i);
    if (m?.[1]) return { title: cleanText(m[1]), author_name: 'お母さん大学' };
  } catch {}
  return null;
}

const metaCache = new Map<string, { title?: string; author_name?: string }>();

export async function fillTitleAuthorIfMissing(hit: { title?: string; author_name?: string; source_url?: string }) {
  if (hit.title && hit.author_name) return hit;

  if (!hit.source_url) return hit;
  
  const cached = metaCache.get(hit.source_url);
  if (cached) {
    hit.title = hit.title ?? cached.title;
    hit.author_name = hit.author_name ?? cached.author_name;
    return hit;
  }

  // 1) oEmbed → 2) posts → 3) HTML の順
  let meta = await fetchMetaFromOEmbed(hit.source_url);
  if (!meta) meta = await fetchMetaFromPosts(hit.source_url);
  if (!meta) meta = await fetchTitleFromHtml(hit.source_url);

  if (meta) {
    metaCache.set(hit.source_url, meta);
    hit.title = hit.title ?? meta.title;
    hit.author_name = hit.author_name ?? meta.author_name;

    // 成功時ログ（前後が分かるように）
    console.log('RAG_META_HIT', { url: hit.source_url, title: hit.title, author: hit.author_name });

    // 将来のためにDBにもベストエフォートで保存
    try {
      const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
      await supabaseAdmin.from('documents')
        .update({ title: meta.title, author_name: meta.author_name })
        .eq('source_url', hit.source_url);
    } catch {}
  } else {
    // 失敗時ログ（既にあればタグ名だけ合わせる）
    console.warn('RAG_META_MISS', hit.source_url);
  }
  return hit;
}


export async function buildReferenceBlock(userMessage: string, picked: { title?: string; author_name?: string; source_url?: string }[]) {
  // lazy-fill処理（タイトル・著者情報の補完）
  for (let i = 0; i < picked.length; i++) {
    picked[i] = await fillTitleAuthorIfMissing(picked[i]);
  }

  // picked に対して lazy-fill を回した直後
  console.log('RAG_META_AFTER', picked.map((p) => ({ url: p.source_url, t: !!p.title, a: !!p.author_name })));

  // 参考記事ブロック生成（新しい構造では不要）
  return '';
}



// JSDoc: クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// findOrCreateParticipant関数は participants.ts に移動済み












/**
 * @JSDoc
 * 【変更】メインのメッセージ処理関数。意図判別に応じて処理を振り分ける。
 */
// 純粋な対話型AIハンドラー
async function handleDialogueAI(
  userId: string,
  text: string
): Promise<string> {
  try {
    console.log('[DIALOGUE] Processing dialogue request for user:', userId);
  
  const participant = await findOrCreateParticipant(userId);

  // ユーザーメッセージをログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'user',
    content: text,
  });

    // 会話履歴を取得
    const { data: chatLogs } = await supabaseAdmin
      .from('chat_logs')
    .select('*')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (chatLogs || [])
      .reverse()
      .map(log => ({
        role: log.role as 'user' | 'assistant',
        content: log.content
      }));

    // 対話型AIの応答を生成
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
          messages: [
        { role: 'system', content: DIALOGUE_AI_SYSTEM },
        ...conversationHistory,
            { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const response = cleanForLine(completion.choices[0]?.message?.content || '');
    
    // AI応答をログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'assistant',
      content: response,
    });

    console.log('[DIALOGUE] Dialogue response generated successfully');
    return response;
  } catch (error) {
    console.error('[DIALOGUE] Error in dialogue AI:', error);
    return 'すみません、少し時間をおいてから再度お話しませんか？';
  }
}

export async function handleTextMessage(userId: string, text: string): Promise<string> {
  // バージョンログ（本番確認用）
  console.log('[APP]', 'rev=', appRev());
  
  // 純粋な対話型AIを使用
  return await handleDialogueAI(userId, text);
}

