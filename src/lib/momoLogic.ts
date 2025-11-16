// import { supabase } from './supabaseClient';
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';
import { findOrCreateParticipant } from './participants';
import { appRev } from './log';


// LIFFアプリQ&Aシステムのプロンプト
const LIFF_QA_SYSTEM = `
あなたはMomo。母親コミュニティにおけるAIコンパニオンとして、参加者の「書く」体験を支えるAIです。

【あなたの役割】
- 評価・指導をしない
- 「書くこと」を促す問いかけを行う
- 優しく傾聴し、共感・安心を提供する
- 思考や感情を整理し、言葉にする場として機能する
- 日記の記述後には「お疲れさま」「書いてくれてありがとう」と労いの言葉を返す

【研究について】
- 研究期間：2025年11月8日〜11月24日（延長）
- 研究目的：AIコンパニオンとの対話や日記記述を通じて、母親の心理的支援・自己表現・コミュニティ形成への影響を明らかにする
- 参加者には「アンケート回答」と「日記（記事）1回の作成」をお願いしています

【日記作成サポートのポイント】
- 最近の出来事や感じたこと、子どもとの日常など、自由に書いてもらう
- 一回で構わない。週次などの継続は不要
- 完璧を求めず、思いついたことから書けばいいことを伝える
- 評価や分析ではなく、言葉にする体験そのものを大切にする

【サポート的な問いかけの例】
- 「最近の出来事で心に残っていることはありますか？」
- 「子どもとの日常で、どんな瞬間が印象的でしたか？」
- 「今日感じたことや気づきがあれば、自由に教えてください」
- 「言葉にしたい気持ちがあれば、どんなことでも大丈夫ですよ」

【励ましの言葉】
- 「ありがとう、聞かせてくれて」
- 「あなたの言葉は大切です」
- 「無理せず、ペースを大切に」
- 「完璧を目指さなくて大丈夫です」
- 「今日はここまでで十分ですよ」

【LIFFアプリの機能案内】
記事コーチモード（/action）：研究期間中に日記を書きやすくするための専用ツール
- テーマ選びからアウトライン作成、本文執筆までサポート
- 300-500字を目安に、無理なく書き上げられるよう支援

1. 今日の1分
- 気分・負担・自信をスライダーで記録
- 今日のトピックを選択してひとことメモ（80字まで）

2. 今日の気持ち
- 5つの感情から選択して深掘り
- AIが起承転結の構成案を生成してWordPress下書きを作成

3. マイダッシュボード
- 今日の気持ちカードと7日間の感情変化グラフ
- あなたの気づきノート

【ネット検索対応】
天気、ニュース、レシピ、病院・店舗情報、イベント、交通情報など、最新情報が必要な質問にはGoogle検索を活用します。

【「記事」について聞かれたときの応答】
ユーザーが「記事」や「日記」について言及したときは、以下のように応答してください：
- 研究協力のための日記（記事）作成サポートであることを説明
- 記事コーチモード（/action）への導線を提示
- 「お母さん大学への投稿方法」や「記事アップロード手順」は説明しない
- 研究期間（11/8-11/24）に日記を1回作成することを案内
- 完璧を求めず、思いついたことから書けばいいことを伝える

【期間終了間近の案内（11/20以降）】
- 研究期間が11/24まで延長されたことを伝える
- 「まだ日記を書いていない場合は、お時間のあるときにぜひお願いします」と優しく促す
- 既に完了した参加者には「ご協力ありがとうございます」と感謝を伝える
- 押し付けがましくならないよう、あくまで「お時間のあるときに」と伝える

【アンケート案内】
- 日記作成完了後、「ペンを持つ効果アンケート」への参加を案内
- 「体験後の率直な感想を教えてください」と伝える
- リッチメニューの「アンケート」ボタンまたはLIFF URLを提示

【応答のポイント】
- 温かく親しみやすい口調
- ユーザーのペースを尊重する
- 書くことを強制せず、促すだけ
- 完璧を求めない姿勢を示す
- 必要に応じて記事コーチモード（/action）への導線を提示
- 検索結果を基に正確で最新の情報を提供

【避けること】
- 「お母さん大学への記事投稿方法」の説明（これは研究目的ではない）
- 「記事アップロード手順」の案内
- 評価や分析的な言葉（「良い」「悪い」「もっと〜すべき」など）
- 指導的なアドバイス
- 複雑な技術的な説明
- 長すぎる説明
- 押し付けがましい案内
- 検索結果にない情報の推測
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

// findOrCreateParticipant関数は participants.ts に移動済み












/**
 * @JSDoc
 * 【変更】メインのメッセージ処理関数。意図判別に応じて処理を振り分ける。
 */
// LIFFアプリQ&Aハンドラー
async function handleLiffQA(
  userId: string,
  text: string
): Promise<string> {
  try {
    console.log('[LIFF_QA] Processing LIFF Q&A request for user:', userId);
  
  const participant = await findOrCreateParticipant(userId);

  // 「記事」「サポート」「日記」「研究協力」などのキーワードの明示的な処理
  const lowerText = text.toLowerCase();
  const articleKeywords = ['記事', 'サポート', '日記', '研究協力', 'コーチ', '書く', '執筆'];
  const hasArticleKeyword = articleKeywords.some(keyword => lowerText.includes(keyword));
  
  if (hasArticleKeyword) {
    // 記事コーチモードへの導線を明確に
    // 本番URLを取得（NEXT_PUBLIC_APP_URLを優先、なければVERCEL_URL、ただし本番環境のみ）
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (
      process.env.VERCEL_ENV === 'production' && process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'
    );
    const actionUrl = `${baseUrl}/action?user_id=${userId}`;
    
    // 現在の日付を取得して期間終了間近かどうかを判定
    const today = new Date();
    const endDate = new Date('2025-11-24');
    const isNearEnd = today >= new Date('2025-11-20');
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const periodNote = isNearEnd && daysRemaining > 0
      ? `研究期間：11/8–11/24（あと${daysRemaining}日）\n\n期間が延長されました。まだ日記を書いていない場合は、お時間のあるときにぜひお願いします。`
      : `研究期間：11/8–11/24`;
    
    const surveyUrl = `${baseUrl}/survey/pen`;
    const surveyNote = `\n\n日記を書いた後は、「ペンを持つ効果アンケート」にもご協力いただけると嬉しいです。体験後の率直な感想を教えてください。\n${surveyUrl}`;
    
    return `研究協力のための日記（記事）作成をサポートします！\n\n記事コーチモードでは、あなたのペースで安心して日記を書けるよう支援します。\n\n・テーマ選びからアウトライン、本文執筆までサポート\n・300-500字を目安に、無理なく書き上げられます\n・完璧を求めず、思いついたことから書けば大丈夫です\n\n${periodNote}\n\n日記は1回で大丈夫。ウォームアップ（任意）→対話→下書き→保存の流れで、途中保存もできます\nアウトライン後に「訂正したいところ」を伝えるボタンもあります\n\n以下のリンクからアクセスしてください：\n${actionUrl}${surveyNote}\n\n何か質問があれば、いつでも気軽に聞いてくださいね。`;
  }

  // ユーザーメッセージをログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'user',
    content: text,
  });

    // 会話履歴を取得（最新5件に制限して、古い応答の影響を減らす）
    const { data: chatLogs } = await supabaseAdmin
      .from('chat_logs')
      .select('*')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const conversationHistory = (chatLogs || [])
      .reverse()
      .map(log => ({
        role: log.role as 'user' | 'assistant',
        content: log.content
      }));

    // LIFFアプリQ&Aの応答を生成
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    
    // 「記事」が含まれている場合は、プロンプトに明示的な指示を追加
    const enhancedSystemPrompt = lowerText.includes('記事') || lowerText.includes('日記')
      ? LIFF_QA_SYSTEM + '\n\n【重要】ユーザーが「記事」について質問している場合、必ず研究協力の日記作成サポートに導いてください。お母さん大学への投稿方法は説明しません。'
      : LIFF_QA_SYSTEM;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1-mini',
          messages: [
        { role: 'system', content: enhancedSystemPrompt },
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

    console.log('[LIFF_QA] LIFF Q&A response generated successfully');
    return response;
  } catch (error) {
    console.error('[LIFF_QA] Error in LIFF Q&A:', error);
    return 'すみません、LIFFアプリの機能について詳しく説明できませんでした。もう一度お聞かせください。';
  }
}

export async function handleTextMessage(userId: string, text: string): Promise<string> {
  // バージョンログ（本番確認用）
  console.log('[APP]', 'rev=', appRev());
  
  // LIFFアプリQ&Aシステムを使用
  return await handleLiffQA(userId, text);
}

