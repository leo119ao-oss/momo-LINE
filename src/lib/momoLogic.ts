// import { supabase } from './supabaseClient';
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';

// 共通のMomoボイス定義
const MOMO_VOICE = `
あなたはMomo。母親の内省を支える温かい相手。
- 口調: やさしく、ねぎらい/共感を一言そえる(〜だね/〜かもね).
- 断定や評価は避け、「〜かも」「〜してみる？」の提案.
- 長文にしすぎない。段落を分けて読みやすく.
- 出力はプレーンテキスト。Markdown装飾は使わない。
- 箇条書きは日本語の点を使う。
`.trim();

// 理由パースのユーティリティ
function _clean(s: any) {
  return String(s ?? '')
    .replace(/^\s*["'\u3000]+|["'\u3000]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 140);
}

function parseReasons(raw: string, want: number): string[] {
  let t = (raw || '').trim();
  // コードフェンス/言語ラベル除去
  t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```json|```/g, '')).trim();
  t = t.replace(/^```json|^```|```$/gm, '').trim();
  // 1) 素直にJSON（配列 or {reasons:[]})
  try {
    const j = JSON.parse(t);
    if (Array.isArray(j)) return j.map(_clean).slice(0, want);
    if (Array.isArray((j as any).reasons)) return (j as any).reasons.map(_clean).slice(0, want);
  } catch {}
  // 2) 角カッコの部分だけ取り出して再パース
  const m = t.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) return arr.map(_clean).slice(0, want);
    } catch {}
  }
  // 3) 箇条書き/番号行のフォールバック
  const lines = t.split('\n')
    .map(l => l
      .replace(/^\s*[-*]\s*/, '')
      .replace(/^\s*\d+[\.\)]\s*/, '')
      .trim())
    .filter(Boolean);
  return lines.map(_clean).slice(0, want);
}

async function generateOneReason(
  userMessage: string,
  item: { url: string; snippet: string }
): Promise<string> {
  const sys = `あなたは記事レコメンドの編集者。以下の候補が質問に「なぜ役立つか」を日本語で１文だけ返す。
- 断定せず「〜に役立ちそう」「〜のヒントがある」等のやわらかい表現
- 具体語を１つ入れる（年齢帯/場面/活動など）
- 出力は１文のみ（飾りや箇条書き禁止）`;
  const prompt = `質問: ${userMessage}
候補URL: ${item.url}
抜粋: """${item.snippet.slice(0, 400)}"""
=> １文だけ出力`;
  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
    });
    return _clean(r.choices[0].message.content ?? '');
  } catch {
    return 'このテーマに関する実践的なヒントがまとまっています。';
  }
}

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
  const j: any = await r.json();
  const title = cleanText(j?.title);
  const author = j?.author_name || 'お母さん大学';
  return title ? { title, author_name: author } : null;
}

async function fetchMetaFromPosts(url: string) {
  const base = 'https://www.okaasan.net/wp-json/wp/v2/posts';
  const slug = getSlugFromUrl(url);
  if (slug) {
    const r1 = await fetch(`${base}?slug=${encodeURIComponent(slug)}&_embed=author&per_page=1`);
    if (r1.ok) {
      const arr: any[] = await r1.json();
      const p = arr?.[0];
      if (p) return {
        title: cleanText(p?.title?.rendered),
        author_name: p?._embedded?.author?.[0]?.name || 'お母さん大学',
      };
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

export async function fillTitleAuthorIfMissing(hit: any) {
  if (hit.title && hit.author_name) return hit;

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


export async function buildReferenceBlock(userMessage: string, picked: any[]) {
  // lazy-fill処理（タイトル・著者情報の補完）
  for (let i = 0; i < picked.length; i++) {
    picked[i] = await fillTitleAuthorIfMissing(picked[i]);
  }

  // picked に対して lazy-fill を回した直後
  console.log('RAG_META_AFTER', picked.map((p: any) => ({ url: p.source_url, t: !!p.title, a: !!p.author_name })));

  // 理由を生成
  const reasonInputs = picked.map((d: any) => ({
    url: d.source_url,
    snippet: (d.content ?? '').slice(0, 500)
  }));
  const reasons = await makeOneSentenceReasons(userMessage, reasonInputs);

  // 失敗検知のログ
  console.log('RAG_REASONS', { want: reasonInputs.length, got: reasons.length, bad: reasons.filter(r => !r || r==='json').length });

  // ビルド情報とログ
  const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) ?? 'local';
  console.log('RAG_FMT', { topk: picked.length, hasReasons: !!reasons?.length, build: BUILD });

  // 参考記事ブロック生成
  const refs = picked.slice(0, 3).map((d: any, i: number) =>
    `[${i+1}] ${reasons[i] || 'このテーマの理解に役立ちそうです。'}\n${d.source_url}`
  ).join('\n');

  return refs;
}

// まずはバッチJSONで作り、壊れていたら１件ずつ生成にフォールバック
async function makeOneSentenceReasons(
  userMessage: string,
  items: { url: string; snippet: string }[]
): Promise<string[]> {
  const want = items.length;
  const sys = `あなたは記事レコメンドの編集者。各候補が質問に「なぜ役立つか」を日本語で１文ずつ作成し、
配列だけをJSONで返す（前後の文章・コードフェンス禁止）。`;
  const list = items.map((it, i) =>
    `[${i+1}] URL: ${it.url}\n抜粋: """${it.snippet.slice(0, 400)}"""`
  ).join('\n');
  const prompt = `質問: ${userMessage}
候補:
${list}
=> １文×${want}個。JSON配列のみで返す`;
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      // JSON配列を強制（対応モデル）
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
    });
    const raw = resp.choices[0].message.content ?? '[]';
    // JSONモードでも念のため堅牢パース
    let reasons = parseReasons(raw, want);
    // 個数が不足/空なら１件ずつ生成
    if (reasons.length < want || reasons.some(r => !r || r.toLowerCase() === 'json')) {
      const each = [];
      for (const it of items) each.push(await generateOneReason(userMessage, it));
      reasons = each;
    }
    // それでも足りなければ埋め草
    while (reasons.length < want) reasons.push('このテーマの理解に役立ちそうです。');
    return reasons.slice(0, want);
  } catch (e) {
    // 最終フォールバック：全部１件ずつ
    const each = [];
    for (const it of items) each.push(await generateOneReason(userMessage, it));
    return each;
  }
}

function expandJaQuery(q: string) {
  const norms: Array<[RegExp, string]> = [
    // 天気・環境関連
    [/雨の日/g, '雨の日 室内 家の中 おうち遊び 外出できない日 天気悪い'],
    [/晴れ/g, '晴れ 外遊び 公園 散歩 外出'],
    [/暑い|寒い/g, '暑い 寒い 温度 気候 季節'],
    
    // 感情・心理関連
    [/イライラ/g, 'イライラ ストレス 気持ちの波 モヤモヤ 怒り 不満'],
    [/疲れ/g, '疲れ 疲労 だるい しんどい 元気ない'],
    [/不安|心配/g, '不安 心配 悩み 困る どうしよう'],
    [/楽しい|嬉しい/g, '楽しい 嬉しい うれしい 喜び 幸せ'],
    
    // 睡眠関連
    [/寝かしつけ|ねかしつけ/g, '寝かしつけ 入眠 寝つき 夜泣き 睡眠 眠り'],
    [/夜泣き/g, '夜泣き 夜中 泣く 睡眠 不眠'],
    
    // 食事関連
    [/離乳食/g, '離乳食 食べない 食事 偏食 取り分け 食育'],
    [/食べない/g, '食べない 偏食 食事 食育 栄養'],
    [/食事/g, '食事 食べ物 料理 栄養 食育'],
    
    // 遊び・学習関連
    [/遊び/g, '遊び おもちゃ ゲーム 活動 楽しみ'],
    [/勉強/g, '勉強 学習 宿題 教育 習い事'],
    [/習い事/g, '習い事 教室 レッスン スキル'],
    
    // 子育て全般
    [/子育て/g, '子育て 育児 親 ママ パパ 教育'],
    [/子ども|子供/g, '子ども 子供 幼児 赤ちゃん 小学生'],
    [/幼稚園/g, '幼稚園 保育園 園 入園 園生活'],
    [/学校/g, '学校 小学校 中学校 高校 教育'],
    
    // 健康・安全関連
    [/病気/g, '病気 体調 健康 医療 病院'],
    [/怪我/g, '怪我 けが 事故 安全 危険'],
    [/安全/g, '安全 危険 注意 気をつける 予防'],
    
    // 人間関係
    [/友達/g, '友達 友だち 人間関係 仲良し コミュニケーション'],
    [/家族/g, '家族 夫 妻 親 祖父母 兄弟'],
  ];
  let out = q;
  for (const [re, add] of norms) {
    if (re.test(q)) out += ' ' + add;
  }
  return out;
}

async function wpFallbackSearch(query: string, limit = 3) {
  try {
    const url = new URL('https://www.okaasan.net/wp-json/wp/v2/posts');
    url.searchParams.set('search', query);
    url.searchParams.set('per_page', String(limit));
    url.searchParams.set('_embed', 'author');
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const posts: any[] = await res.json();

    const sanitize = (s: string) => (s || '').replace(/<[^>]*>/g, '').trim();
    return posts.map(p => ({
      url: p.link as string,
      snippet: sanitize(p?.excerpt?.rendered || p?.title?.rendered || ''),
    }));
  } catch {
    return [];
  }
}

// JSDoc: クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSDoc: ユーザー情報を取得または作成する関数
async function findOrCreateParticipant(lineUserId: string) {
  let { data: participant } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  if (!participant) {
    const { data: newParticipant, error } = await supabaseAdmin
      .from('participants')
      .insert({ line_user_id: lineUserId, archetype: 'B' })
      .select()
      .single();
    
    if (error) throw error;
    participant = newParticipant;
  }
  return participant;
}

type UserIntent = 'information_seeking' | 'personal_reflection';

// モード切替のヒステリシス用
let lastMode: 'information_seeking' | 'personal_reflection' | null = null;

function chooseMode(intent: UserIntent, text: string): UserIntent {
  // 質問記号などがあれば即IS
  if (/[？\?]/.test(text)) return 'information_seeking';
  // 直近がreflectionで今回も短文なら継続
  if (lastMode === 'personal_reflection' && text.length < 25) return 'personal_reflection';
  return intent;
}

// 会話コンテキストを取得する共通関数
async function getConversationContext(participantId: number) {
  const { data: logs } = await supabaseAdmin
    .from('chat_logs')
    .select('role, content')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(8);

  const recent = (logs ?? []).reverse();
  const lastUser = [...recent].reverse().find(l => l.role === 'user')?.content ?? '';
  const thread = recent.map(l => `${l.role === 'user' ? 'U' : 'AI'}: ${l.content}`).join('\n');
  return { lastUser, thread };
}

/**
 * @JSDoc
 * 【新規追加】ユーザーのメッセージの意図を判別する「受付係」AI。
 * @param userMessage ユーザーからのテキストメッセージ
 * @returns 'information_seeking' (情報探索) または 'personal_reflection' (内省的なつぶやき)
 */
async function detectUserIntent(userMessage: string): Promise<UserIntent> {
  // NotebookLMレベルの自由度: より多くの質問パターンをキャッチ
  const questionKeywords = [
    'どう', '教えて', '方法', '何', 'どこ', 'いつ', 'おすすめ', '使い方', '遊び', 'コツ', 
    '困る', '悩み', '解決', 'したい', 'やり方', '知りたい', 'について', 'なぜ', 'どうして',
    'できる', 'できない', 'ある', 'ない', 'あるの', 'ないの', 'する', 'しない', 'やる', 'やらない',
    'いい', '悪い', '良い', '悪い', 'おすすめ', '避ける', '注意', '気をつける', '心配', '不安',
    '楽しい', '面白い', 'つまらない', '大変', '簡単', '難しい', '便利', '不便', '効果的', '無駄',
    '時間', 'お金', '場所', '人', '物', 'こと', 'もの', 'とき', '場合', '状況', '問題', '課題',
    '子育て', '育児', '子ども', '赤ちゃん', '幼児', '小学生', '中学生', '高校生', '学校', '幼稚園',
    '食事', '睡眠', '遊び', '勉強', '習い事', '運動', '健康', '病気', '怪我', '安全', '危険',
    '友達', '家族', '夫', '妻', '親', '祖父母', '兄弟', '姉妹', 'ママ', 'パパ', 'お母さん', 'お父さん'
  ];
  
  const quickAskRegex = new RegExp(`[？\?]|(${questionKeywords.join('|')})`);
  if (quickAskRegex.test(userMessage)) return 'information_seeking';
  
  const prompt = `
    以下のユーザーメッセージが、「具体的な情報を求める質問」か「自身の感情や出来事についての内省的なつぶやき」かを分類してください。
    
    質問の例（NotebookLMレベルの自由度）：
    - 「雨の日 室内 おうち遊び」（情報探索）
    - 「子どもが言うことを聞かない」（問題解決の質問）
    - 「離乳食 食べない」（具体的な悩み）
    - 「寝かしつけ 時間がかかる」（困りごと）
    - 「イライラ 解消方法」（解決策を求める）
    - 「幼稚園 選び方」（選択肢を求める）
    - 「習い事 何がいい？」（推奨を求める）
    - 「友達 作り方」（方法を求める）
    - 「夜泣き 対処法」（対策を求める）
    - 「子育て 大変」（共感とアドバイスを求める）
    
    つぶやきの例：
    - 「疲れた〜」（感情の吐露）
    - 「今日は大変だった」（出来事の報告）
    - 「なんだか悲しい」（感情の表現）
    - 「うれしい」（感情の表現）
    - 「子どもが可愛い」（感情の表現）
    
    判断基準：
    - 何らかの情報、方法、解決策、アドバイスを求めている → "information_seeking"
    - 単純に感情や出来事を共有している → "personal_reflection"
    
    - 質問の場合は "information_seeking"
    - つぶやきの場合は "personal_reflection"
    とだけ回答してください。

    メッセージ: "${userMessage}"
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const result = completion.choices[0].message.content?.trim();
    console.log('Intent detection result:', result); // ★デバッグ用のログ
    if (result === 'information_seeking') {
      return 'information_seeking';
    }
  } catch (error) {
    console.error('Intent detection failed:', error);
  }
  return 'personal_reflection'; // デフォルトまたはエラー時は「つぶやき」として扱う
}

/**
 * @JSDoc
 * 【新規追加】情報探索（質問）に対応するRAG処理を行う関数。
 * @param participant 参加者情報（会話履歴取得用）
 * @param userMessage ユーザーからの質問
 * @returns AIが生成した回答と引用元URL
 */
async function handleInformationSeeking(participant: any, userMessage: string): Promise<string> {
  console.log('Handling information seeking intent...');
  try {
    // 1st try: 元のクエリでベクトル検索
    let queryText = userMessage;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Supabase DBから関連情報を検索 (SQLで作成した関数を呼び出す)
    const { data: documents, error } = await supabaseAdmin.rpc('match_documents_arr', {
      query_embedding: queryEmbedding, // number[]
      match_count: 8
    });

    if (error) throw new Error(`Supabase search error: ${error.message}`);
    
    let docs = documents ?? [];
    console.log(`[RAG] raw_hits: ${docs.length}, topSim: ${docs[0]?.similarity || 0}`);

    // 0件なら 2nd try with expanded query
    if (!docs.length) {
      const expanded = expandJaQuery(userMessage);
      if (expanded !== userMessage) {
        const emb2 = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: expanded,
        });
        const { data: docs2 } = await supabaseAdmin.rpc('match_documents_arr', {
          query_embedding: emb2.data[0].embedding, match_count: 8
        });
        docs = docs2 ?? [];
      }
    }
    
    // documents には similarity を含む前提（match_documents_arr）
    const MIN_SIM = 0.15; // NotebookLMレベルの自由度: より低い閾値で関連記事を取得
    const filtered = docs.filter((d: any) => (d.similarity ?? 0) >= MIN_SIM);
    const picked = (filtered.length ? filtered : docs).slice(0, 3); // 3件固定
    console.log(`[RAG] after_filter: ${filtered.length}, picked: ${picked.length}`);

    // picked に対して lazy-fill を回す直前
    console.log('RAG_META_BEFORE', picked.map((p: any) => ({ url: p.source_url, t: !!p.title, a: !!p.author_name })));

    // ここまでで picked.length が0ならフォールバック
    if (picked.length === 0) {
      const wp = await wpFallbackSearch(userMessage, 3);
      if (wp.length) {
        // WPデータをpicked形式に変換してbuildReferenceBlockを使用
        const wpAsPicked = wp.map(p => ({ source_url: p.url, content: p.snippet || '' }));
        const refs = await buildReferenceBlock(userMessage, wpAsPicked);
        return `手元のベクトル検索では直接ヒットがなかったけど、近いテーマの記事を見つけたよ。\n\n— 参考記事 —\n${refs}`;
      }
      
      // 同意フラグを保存し、質問
      const exp = new Date(Date.now()+ 1000*60*10).toISOString(); // 10分有効
      await supabaseAdmin.from('pending_intents').insert({
        participant_id: participant.id,
        kind: 'web_search',
        payload: { query: userMessage },
        expires_at: exp
      });
      return '手元の知識では見つからなかったよ。\nよかったらネットでも調べようか？（はい / いいえ）';
    }

    const contextText = picked.map((d: any) => d.content).join('\n---\n');
    const sourceUrls = Array.from(new Set(picked.map((d: any) => d.source_url)));

    const { lastUser, thread: recentThread } = await getConversationContext(participant.id);
    const systemPrompt = `
${MOMO_VOICE}

[最近の会話ログ]
${recentThread}

[ルール]
1) 冒頭に1〜2文だけ共感を添える（過度な深掘りはしない）。
2) 次に、提供されたコンテキストの範囲で質問に答える。
3) 断定は避け、「〜かも」「〜という考え方も」で柔らかく。
4) 箇条書きOK。最後に一言だけ励ます。
5) コンテキスト外は無理に答えない。
6) 出力はプレーンテキスト。Markdown装飾は使わない。
7) 箇条書きは日本語の点を使う。
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `コンテキスト:\n${contextText}\n\n質問: ${userMessage}\n\n直前ユーザー発話: ${lastUser}` }
      ],
    });

    const answer = completion.choices[0].message.content || 'すみません、うまくお答えできませんでした。';
    
    // 参考記事ブロック生成
    const refs = await buildReferenceBlock(userMessage, picked);
    return `${answer}\n\n— 参考記事 —\n${refs}`;

  } catch (error) {
    console.error('RAG process failed:', error);
    return '申し訳ありません、情報の検索中にエラーが発生しました。もう一度お試しください。';
  }
}

/**
 * @JSDoc
 * 【変更】メインのメッセージ処理関数。意図判別に応じて処理を振り分ける。
 */
export async function handleTextMessage(userId: string, text: string): Promise<string> {
  const participant = await findOrCreateParticipant(userId);

  // ユーザーメッセージをログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'user',
    content: text,
  });

  // 未回答の画像があればキャプション確定（最優先）
  const { data: pending } = await supabaseAdmin
    .from('media_entries')
    .select('*')
    .eq('participant_id', participant.id)
    .eq('status', 'awaiting')
    .order('created_at', { ascending: false })
    .limit(1);

  if (pending?.length) {
    const m = pending[0];
    const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
    const sys = 'あなたは写真日記の編集者。ユーザーの一言を活かし、やさしい1文キャプションを作る。';
    const prompt = `画像メモ: ${m.guess}\nユーザーの追記: ${text}\n→ 30〜60字の一文キャプションで。`;
    const c = await openai.chat.completions.create({ 
      model:'gpt-4o-mini', 
      messages:[{role:'system',content:sys},{role:'user',content:prompt}], 
      temperature:0.3 
    });
    const caption = c.choices[0].message.content?.trim() || text.trim();
    await supabaseAdmin.from('media_entries').update({ 
      user_answer: text, 
      caption, 
      status:'done' 
    }).eq('id', m.id);
    return `できたよ。\n「${caption}」\n（このあと一覧ページも作れるようにするね）\n${m.image_url}`;
  }

  // 直近の同意待ちを確認
  const { data: pi } = await supabaseAdmin
    .from('pending_intents')
    .select('*')
    .eq('participant_id', participant.id)
    .eq('kind','web_search')
    .gt('expires_at', new Date().toISOString())
    .order('created_at',{ascending:false})
    .limit(1);

  const yes = /^(はい|うん|ok|お願いします|お願い|調べて|いいよ)/i.test(text.trim());
  const no  = /^(いいえ|いらない|大丈夫|結構)/i.test(text.trim());

  if (pi && pi.length){
    if (yes){
      await supabaseAdmin.from('pending_intents').delete().eq('id', pi[0].id);
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
      url.pathname = '/api/search/google'; 
      url.searchParams.set('q', (pi[0].payload as any)?.query || text);
      const r = await fetch(url.toString()); 
      const { items } = await r.json();
      if(!items?.length) return '検索してみたけれど、めぼしい情報は見つからなかったよ。';
      // 4o-miniで3件要約
      const digest = items.slice(0,3).map((it:any,i:number)=>`[${i+1}] ${it.title}\n${it.snippet}\n${it.link}`).join('\n\n');
      const sys = 'あなたはリサーチアシスタント。上の候補を3行で要約し、最後に「次の一歩」を1文添える。装飾不可。';
      const oai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
      const c = await oai.chat.completions.create({ 
        model:'gpt-4o-mini', 
        temperature:0.2,
        messages:[{role:'system',content:sys},{role:'user',content:digest}]
      });
      return c.choices[0].message.content || digest;
    } else if (no){
      await supabaseAdmin.from('pending_intents').delete().eq('id', pi[0].id);
      return '了解。また必要になったら声かけてね。';
    }
    // 同意/拒否でない普通の文章 → 何もしない（通常フロー続行）
  }

  // ユーザーの意図を判別
  const rawIntent = await detectUserIntent(text);
  const intent = chooseMode(rawIntent, text);
  lastMode = intent;
  console.log(`[Intent] User message: "${text}" -> Raw: ${rawIntent} -> Final: ${intent}`);
  let aiMessage: string;

  if (intent === 'information_seeking') {
    // 【質問の場合】RAG処理を呼び出す
    aiMessage = await handleInformationSeeking(participant, text);
  } else {
    // 【つぶやきの場合】従来のカウンセラー応答
    console.log('Handling personal reflection intent...');
    const { data: history } = await supabaseAdmin
      .from('chat_logs')
      .select('role, content')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(9); // 最新のユーザーメッセージを除いて9件取得
    
    const messages = (history || [])
      .reverse()
      .map(log => ({
        role: log.role === 'ai' ? 'assistant' : 'user',
        content: log.content
      })) as { role: 'user' | 'assistant'; content: string }[];

    // 現在のユーザーメッセージを追加
    messages.push({ role: 'user', content: text });

      const profile = participant.profile_summary ? `\n[ユーザープロフィール要約]\n${participant.profile_summary}\n` : '';
      const reflectionSystem = `
${MOMO_VOICE}${profile}

[ルール]
- 相づち→ねぎらい→一息つける提案を1つだけ。
- 連続質問はしない。問いは最大1つ。
- ユーザーの表現を少し言い換えて返す（ミラーリング）。
- 出力はプレーンテキスト。Markdown装飾は使わない。
- 箇条書きは日本語の点を使う。
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: reflectionSystem }, ...messages],
    });
    aiMessage = completion.choices[0].message.content || 'うんうん、そうなんだね。';
  }

  // AIの応答をログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'assistant',
    content: aiMessage,
  });

  // プロフィール要約を非同期で更新（ベストエフォート）
  updateProfileSummary(participant.id).catch(console.error);

  // 生成済みの aiMessage を LINE 向けに整形
  aiMessage = cleanForLine(aiMessage);

  return aiMessage;
}

/**
 * @JSDoc
 * 【新規追加】ユーザーのプロフィール要約を更新する関数（非同期実行）
 * @param participantId 参加者ID
 */
async function updateProfileSummary(participantId: number) {
  const { data: logs } = await supabaseAdmin
    .from('chat_logs')
    .select('role, content')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: true })
    .limit(50);

  const transcript = (logs ?? [])
    .map(l => `${l.role === 'user' ? 'U' : 'AI'}: ${l.content}`)
    .join('\n');

  const prompt = `
以下の会話ログから、ユーザーに関する「継続的に役立つ情報」（子どもの年齢感/好み/配慮点/口調の好み/通知の希望など）を
事実ベースで200字以内に日本語で箇条書き要約してください。推測や機微な情報は書かないでください。
---
${transcript}
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const summary = completion.choices[0].message.content?.trim() ?? null;
    if (summary) {
      await supabaseAdmin.from('participants')
        .update({ profile_summary: summary })
        .eq('id', participantId);
      console.log(`[Profile] Updated summary for participant ${participantId}`);
    }
  } catch (e) { 
    console.error('updateProfileSummary failed', e); 
  }
}