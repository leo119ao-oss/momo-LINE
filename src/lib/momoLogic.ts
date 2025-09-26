// import { supabase } from './supabaseClient';
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';
import { searchArticles } from './search';
import { buildInfoPrompt, buildConfirmPrompt, EMPATHY_REFLECTIVE_SYSTEM, EMPATHY_REFLECTIVE_FEWSHOT, NEW_CONVERSATION_FLOW_SYSTEM, EMOTION_CHECK_PROMPT, REASON_HEARING_PROMPT, INSIGHT_PROMPT, DIARY_RECOMMENDATION_PROMPT, ARTICLE_RECOMMENDATION_PROMPT } from './prompts';
import { detectEmotion, generateReasonQuestion, checkStoryCompleteness, structureStory, type ConversationState, type ConversationStage } from './conversationFlow';
import { generateInsights, generateDeepeningQuestion } from './insightGenerator';
import { recommendDiary } from './diaryRecommender';
import { recommendRelatedArticles } from './articleRecommender';
import { flags } from '../config/flags';
import { logEmpathyMeta } from './log';
import { oneLineWhy } from './rag';
import { appRev } from './log';
import { slugify } from './slug';
import { logRagEvent } from './telemetry';
import { findOrCreateParticipant } from './participants';

// 共通のMomoボイス定義
const MOMO_VOICE = `
あなたはMomo。母親の内省を支える温かい相手。
- 口調: やさしく、ねぎらい/共感を一言そえる(〜だね/〜かもね).
- 断定や評価は避け、「〜かも」「〜してみる？」の提案.
- 長文にしすぎない。段落を分けて読みやすく.
- 出力はプレーンテキスト。Markdown装飾は使わない。
- 箇条書きは日本語の点を使う。
- 対話を重視し、ユーザーの気持ちを受け止めて深く聞く。
- 記事の紹介や検索は行わず、純粋な対話に集中する。
`.trim();

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
    .select('role, content, created_at')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(20); // より多くの会話履歴を取得

  const recent = (logs ?? []).reverse();
  const lastUser = [...recent].reverse().find(l => l.role === 'user')?.content ?? '';
  
  // 会話の流れを分析
  const conversationFlow = analyzeConversationFlow(recent);
  
  // 過去の会話の要約を作成（長い場合）
  let thread: string;
  if (recent.length > 10) {
    // 最新の5件と古い会話の要約
    const latest = recent.slice(-5);
    const older = recent.slice(0, -5);
    const olderSummary = older.length > 0 ? 
      `[過去の会話要約: ${older.length}件のやり取りがありました]` : '';
    thread = olderSummary + '\n' + latest.map(l => `${l.role === 'user' ? 'U' : 'AI'}: ${l.content}`).join('\n');
  } else {
    thread = recent.map(l => `${l.role === 'user' ? 'U' : 'AI'}: ${l.content}`).join('\n');
  }
  
  return { lastUser, thread, conversationFlow };
}

// 会話の流れを分析する関数
function analyzeConversationFlow(logs: { role: string; content?: string; created_at?: string }[]) {
  const userMessages = logs.filter(l => l.role === 'user').slice(-3); // 直近3つのユーザーメッセージ
  const aiMessages = logs.filter(l => l.role === 'assistant').slice(-3); // 直近3つのAIメッセージ
  
  // 会話のテーマを抽出
  const themes = userMessages.map(msg => extractTheme(msg.content || '')).filter(Boolean);
  const lastTheme = themes[themes.length - 1];
  
  // 会話の深さを判定
  const isDeepConversation = userMessages.length >= 2 && 
    userMessages.some(msg => (msg.content || '').length > 20);
  
  // 会話の文脈をより詳細に分析
  const conversationContext = {
    hasUnclearResponses: userMessages.some(msg => 
      /^(はそう|そう|うん|はい|いいえ|わからない|知らない|何|なに|どう|なぜ|どうして|あの|えー|うーん|んー|そうですね|それ|これ|あれ|どれ)$/i.test((msg.content || '').trim())
    ),
    averageMessageLength: userMessages.reduce((sum, msg) => sum + (msg.content || '').length, 0) / userMessages.length,
    lastMessageLength: (userMessages[userMessages.length - 1]?.content || '').length,
    conversationDepth: userMessages.length,
    hasQuestions: userMessages.some(msg => /[？\?]/.test(msg.content || '')),
    hasEmotionalWords: userMessages.some(msg => 
      /(疲れ|イライラ|不安|心配|楽しい|嬉しい|悲しい|困る|悩み)/.test(msg.content || '')
    )
  };
  
  return {
    themes,
    lastTheme,
    isDeepConversation,
    messageCount: userMessages.length,
    lastUserMessage: userMessages[userMessages.length - 1]?.content || '',
    lastAiMessage: aiMessages[aiMessages.length - 1]?.content || '',
    conversationContext
  };
}

// メッセージからテーマを抽出する関数
function extractTheme(message: string): string | null {
  const themeKeywords = [
    '子育て', '育児', '子ども', '赤ちゃん', '幼児',
    '食事', '睡眠', '遊び', '勉強', '習い事',
    '疲れ', 'イライラ', '不安', '心配', '楽しい',
    '友達', '家族', '夫', '妻', '親',
    '病気', '怪我', '安全', '健康'
  ];
  
  for (const keyword of themeKeywords) {
    if (message.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}


/**
 * @JSDoc
 * 【改善版】低確度時の確認質問フォールバック関数
 * @param q ユーザーメッセージ
 * @returns 2択+自由入力の確認質問
 */
async function _askForClarification(q: string): Promise<string> {
  return buildConfirmPrompt(q, [
    "A) もう少しレシピの基本が知りたい",
    "B) 今日作れる代替案を提案してほしい"
  ]);
}

/**
 * @JSDoc
 * 【新規追加】会話内容が不明確な場合を検出し、適切に聞き返す関数
 * @param userMessage ユーザーメッセージ
 * @param conversationContext 会話の文脈
 * @returns 聞き返しが必要な場合の応答、またはnull
 */
async function checkForClarification(userMessage: string, conversationContext: { isDeepConversation?: boolean; lastTheme?: string | null; messageCount?: number }): Promise<string | null> {
  // 不明確なメッセージのパターンを検出
  const unclearPatterns = [
    /^(はそう|そう|うん|はい|いいえ|わからない|知らない)$/i, // 単純な相づち
    /^(何|なに|どう|なぜ|どうして)$/i, // 単語のみ
    /^(あの|えー|うーん|んー|そうですね)$/i, // 曖昧な表現
    /^.{1,3}$/, // 3文字以下の短いメッセージ
    /^(それ|これ|あれ|どれ)$/i, // 指示語のみ
  ];

  // 不明確なパターンに該当するかチェック
  const isUnclear = unclearPatterns.some(pattern => pattern.test(userMessage.trim()));
  
  if (!isUnclear) return null;

  // 会話の文脈から推察を試みる
  const contextInfo = conversationContext.isDeepConversation ? 
    `前回のテーマ: ${conversationContext.lastTheme || '新しい話題'}\n前回のAI応答: ${(conversationContext as any).lastAiMessage || 'なし'}` : 
    '新しい会話の開始';

  const prompt = `
以下の状況で、ユーザーが不明確な返答をした場合の適切な聞き返しを考えてください。

【会話の文脈】
${contextInfo}

【ユーザーの返答】
"${userMessage}"

【聞き返しのルール】
1) 推察を交えつつ、具体的に何について聞きたいかを明確にする
2) 選択肢を提示するか、具体的な質問をする
3) 優しく、プレッシャーを感じさせない
4) 会話の流れを自然に保つ
5) 1-2文で簡潔に

【例】
- 「はそう」→「そうなんだね。具体的には、どんなことが気になってる？」
- 「わからない」→「大丈夫だよ。何について話したいか、少し教えてもらえる？」
- 「それ」→「○○のことかな？もう少し詳しく教えてもらえる？」

適切な聞き返しの文を1つだけ返してください。聞き返しが不要な場合は「null」と返してください。
  `.trim();

  try {
    const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    const response: string | null = typeof raw === 'string' ? raw.trim() : null;
    if (!response || response.toLowerCase() === 'null') return null;
    return response;
  } catch (error) {
    console.error('Clarification check failed:', error);
    return null;
  }
}

/**
 * @JSDoc
 * 【調整】ユーザーのメッセージの意図を判別する「受付係」AI。
 * RAG検索は明示的な情報要求の場合のみ実行するように調整。
 * @param userMessage ユーザーからのテキストメッセージ
 * @returns 'information_seeking' (情報探索) または 'personal_reflection' (内省的なつぶやき)
 */
async function detectUserIntent(userMessage: string): Promise<UserIntent> {
  // 明示的な情報要求のキーワード（より厳格に）
  const explicitInfoKeywords = [
    '教えて', '方法', 'やり方', '知りたい', 'おすすめ', 'コツ', '解決', '対処法', '選び方',
    'どうすれば', 'どうしたら', '何を', 'どこで', 'いつ', 'なぜ', 'どうして', '調べて', '検索して'
  ];
  
  // 過去の会話に関する質問は内省モードで処理
  const conversationKeywords = [
    '今まで', '何の話', '話してた', '会話', '前回', 'さっき', '先ほど', '話した', '言った'
  ];
  
  if (conversationKeywords.some(keyword => userMessage.includes(keyword))) {
    return 'personal_reflection';
  }
  
  // 明示的な質問記号または情報要求キーワードがある場合のみ情報探索
  const explicitInfoRegex = new RegExp(`[？\?]|(${explicitInfoKeywords.join('|')})`);
  if (explicitInfoRegex.test(userMessage)) {
    // さらに、会話の文脈を考慮して最終判断
    return await finalizeIntentWithContext(userMessage);
  }
  
  // デフォルトは内省的なつぶやきとして扱う
  return 'personal_reflection';
}

/**
 * @JSDoc
 * 【新規追加】文脈を考慮した最終的な意図判定
 * @param userMessage ユーザーメッセージ
 * @returns 最終的な意図
 */
async function finalizeIntentWithContext(userMessage: string): Promise<UserIntent> {
  const prompt = `
    以下のユーザーメッセージが、「明示的な情報・解決策を求めている」か「感情や状況の共有」かを判定してください。
    
    【情報探索の例】
    - 「雨の日の室内遊びを教えて」
    - 「子どもが言うことを聞かない時の対処法は？」
    - 「離乳食を食べない場合の解決方法を知りたい」
    - 「寝かしつけのコツを教えて」
    - 「イライラの解消方法は？」
    - 「幼稚園の選び方について知りたい」
    - 「習い事で何がおすすめ？」
    - 「友達の作り方を教えて」
    - 「夜泣きの対処法は？」
    
    【感情・状況共有の例】
    - 「雨の日は子どもと家にいるのが大変」
    - 「子どもが言うことを聞かなくて困ってる」
    - 「離乳食を食べてくれない」
    - 「寝かしつけに時間がかかる」
    - 「イライラしてしまう」
    - 「幼稚園選びで迷ってる」
    - 「習い事を考えてる」
    - 「友達ができなくて心配」
    - 「夜泣きがひどい」
    
    判断基準：
    - 明示的に「教えて」「方法」「対処法」「コツ」などを求めている → "information_seeking"
    - 感情や状況を共有している（解決策は求めていない） → "personal_reflection"

    メッセージ: "${userMessage}"
    
    "information_seeking" または "personal_reflection" のどちらかで回答してください。
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const raw = completion.choices?.[0]?.message?.content;
    const result: string | null = typeof raw === 'string' ? raw.trim() : null;
    console.log('Context-aware intent detection result:', result);
    if (result === 'information_seeking') {
      return 'information_seeking';
    }
  } catch (error) {
    console.error('Context-aware intent detection failed:', error);
  }
  return 'personal_reflection'; // デフォルトは内省的なつぶやき
}

/**
 * @JSDoc
 * 【新規追加】情報探索（質問）に対応するRAG処理を行う関数。
 * @param participant 参加者情報（会話履歴取得用）
 * @param userMessage ユーザーからの質問
 * @returns AIが生成した回答と引用元URL
 */
async function handleInformationSeeking(participant: { id: string; display_name?: string; contact?: string }, userMessage: string): Promise<string> {
  console.log('Handling information seeking intent...');
  try {
    // 新しいRAG検索を使用
    const hits = await searchArticles(userMessage);
    
    // テレメトリログを出力
    logRagEvent({
      rev: appRev(),
      intent: "info",
      q: userMessage,
      topK: 3,
      minSim: 0.45,
      rawCount: hits.length,
      keptCount: hits.length,
      lowConfFallback: hits.length === 0
    });
    
    // 低確度の場合は確認質問にフォールバック
    if (hits.length === 0) {
      return buildConfirmPrompt(userMessage, [
        "A) もう少しレシピの基本が知りたい",
        "B) 今日作れる代替案を提案してほしい"
      ]);
    }

    const { lastUser, thread: _recentThread, conversationFlow } = await getConversationContext(parseInt(participant.id));
    
    // 不明確なメッセージの場合は聞き返しを優先
    const clarificationResponse = await checkForClarification(userMessage, conversationFlow);
    if (clarificationResponse) {
      return clarificationResponse;
    }
    
    // 会話の継続性を考慮したシステムプロンプト
    const _contextInfo = conversationFlow.isDeepConversation ? 
      `\n[会話の流れ]\n前回のテーマ: ${conversationFlow.lastTheme || '新しい話題'}\n会話の深さ: ${conversationFlow.messageCount}回のやり取り` : '';
    
    const contextText = hits.map(h => h.chunk).join('\n---\n');
    const systemPrompt = buildInfoPrompt(userMessage, hits.map(h => ({ title: h.title, url: h.url })));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `コンテキスト:\n${contextText}\n\n質問: ${userMessage}\n\n直前ユーザー発話: ${lastUser}` }
      ],
    });

    const answer = completion.choices[0].message.content || 'すみません、うまくお答えできませんでした。';
    
    // 3件・1文理由の常時適用
    const refs = hits.map((hit, i) =>
      `[${i+1}] ${oneLineWhy(userMessage, hit)}\n${hit.url}`
    ).join('\n');

    return `${answer}\n\n— 参考記事 —\n${refs}`;

  } catch (error) {
    console.error('RAG process failed:', error);
    return '申し訳ありません、情報の検索中にエラーが発生しました。もう一度お試しください。';
  }
}

/**
 * @JSDoc
 * 【新規追加】新しい会話フローを処理する関数
 */
async function handleNewConversationFlow(
  participant: { id: string; display_name?: string; contact?: string },
  text: string
): Promise<string> {
  try {
    // 会話履歴を取得
    const { data: history } = await supabaseAdmin
      .from('chat_logs')
      .select('role, content, created_at')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (history || []).map(log => ({
      role: log.role,
      content: log.content
    }));

    // 現在の会話状態を取得
    const conversationState = await getConversationState(participant.id, conversationHistory);
    
    // 会話の段階に応じて処理
    switch (conversationState.stage) {
      case 'emotion_check':
        return await handleEmotionCheck(text, conversationState);
      
      case 'reason_hearing':
        return await handleReasonHearing(text, conversationState);
      
      case 'insight_generation':
        return await handleInsightGeneration(text, conversationState);
      
      case 'diary_recommendation':
        return await handleDiaryRecommendation(text, conversationState);
      
      case 'article_recommendation':
        return await handleArticleRecommendation(text, conversationState);
      
      default:
        return await handleEmotionCheck(text, conversationState);
    }
  } catch (error) {
    console.error('New conversation flow failed:', error);
    return '申し訳ありません、エラーが発生しました。もう一度お試しください。';
  }
}

/**
 * @JSDoc
 * 【新規追加】会話状態を取得する関数
 */
async function getConversationState(participantId: string, conversationHistory: Array<{role: string, content: string}>): Promise<ConversationState> {
  // 会話の深さを計算
  const userMessages = conversationHistory.filter(msg => msg.role === 'user');
  const conversationDepth = userMessages.length;
  
  // 最後のメッセージを取得
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
  const lastAiMessage = conversationHistory.filter(msg => msg.role === 'assistant').slice(-1)[0]?.content || '';
  
  // 会話の段階を判定
  let stage: ConversationStage = 'emotion_check';
  
  if (conversationDepth >= 1 && !lastUserMessage.includes('感情')) {
    stage = 'reason_hearing';
  }
  
  if (conversationDepth >= 2 && lastAiMessage.includes('示唆')) {
    stage = 'insight_generation';
  }
  
  if (conversationDepth >= 4 && checkStoryCompleteness(conversationHistory)) {
    stage = 'diary_recommendation';
  }
  
  return {
    stage,
    conversationDepth,
    lastUserMessage,
    lastAiMessage
  };
}

/**
 * @JSDoc
 * 【新規追加】感情確認の処理
 */
async function handleEmotionCheck(text: string, state: ConversationState): Promise<string> {
  const emotionResult = await detectEmotion(text);
  
  if (emotionResult.confidence > 0.5) {
    const reasonQuestion = generateReasonQuestion(emotionResult.emotion, text);
    return reasonQuestion;
  } else {
    return EMOTION_CHECK_PROMPT;
  }
}

/**
 * @JSDoc
 * 【新規追加】理由ヒアリングの処理
 */
async function handleReasonHearing(text: string, state: ConversationState): Promise<string> {
  // 感情を再検出
  const emotionResult = await detectEmotion(state.lastUserMessage);
  
  // 示唆を生成
  const insights = await generateInsights(emotionResult.emotion, text, state.lastUserMessage);
  
  if (insights.insights.length > 0) {
    return INSIGHT_PROMPT(emotionResult.emotion, text, insights.insights);
  } else {
    return 'その気持ち、よく分かります。もう少し詳しく教えてもらえる？';
  }
}

/**
 * @JSDoc
 * 【新規追加】示唆生成の処理
 */
async function handleInsightGeneration(text: string, state: ConversationState): Promise<string> {
  // 会話の完全性をチェック
    const { data: history } = await supabaseAdmin
      .from('chat_logs')
      .select('role, content')
    .eq('participant_id', state.conversationDepth.toString())
    .order('created_at', { ascending: true })
    .limit(10);
  
  const conversationHistory = (history || []).map(log => ({
    role: log.role,
        content: log.content
  }));
  
  if (checkStoryCompleteness(conversationHistory)) {
    // 日記推奨に移行
    const diaryRecommendation = await recommendDiary(conversationHistory, state.conversationDepth.toString());
    
    if (diaryRecommendation.shouldRecommend) {
      return DIARY_RECOMMENDATION_PROMPT(diaryRecommendation.structure);
    }
  }
  
  // 深堀り質問を生成
  const deepeningQuestion = await generateDeepeningQuestion(
    state.lastUserMessage,
    text,
    state.lastAiMessage
  );
  
  return deepeningQuestion;
}

/**
 * @JSDoc
 * 【新規追加】日記推奨の処理
 */
async function handleDiaryRecommendation(text: string, state: ConversationState): Promise<string> {
  // 日記が完成した場合、関連記事を推薦
  if (text.includes('完成') || text.includes('書いた') || text.includes('終わった')) {
    const articleRecommendation = await recommendRelatedArticles(text, state.conversationDepth.toString());
    
    if (articleRecommendation.articles.length > 0) {
      return ARTICLE_RECOMMENDATION_PROMPT(articleRecommendation.articles);
    }
  }
  
  return '日記を書いてみて、どんな気持ちになりましたか？';
}

/**
 * @JSDoc
 * 【新規追加】記事推薦の処理
 */
async function handleArticleRecommendation(text: string, state: ConversationState): Promise<string> {
  return '他にも何かお話したいことはありますか？';
}

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
    const raw = completion.choices?.[0]?.message?.content;
    const summary: string | null = typeof raw === 'string' ? raw.trim() : null;
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

/**
 * @JSDoc
 * 【新規追加】重要な会話情報を記憶に保存する関数（非同期実行）
 * @param participantId 参加者ID
 * @param userMessage ユーザーメッセージ
 * @param aiMessage AI応答
 */
async function saveImportantConversationInfo(participantId: number, userMessage: string, aiMessage: string) {
  // 重要な情報を含むメッセージかどうかを判定
  const isImportant = userMessage.length > 30 || 
    /(子どもの年齢|名前|好き|嫌い|困って|悩み|心配|不安|楽しい|嬉しい)/.test(userMessage);
  
  if (!isImportant) return;
  
  try {
    // 重要な情報を抽出して保存
    const prompt = `
以下の会話から、ユーザーに関する「重要な情報」（子どもの年齢、名前、好み、困りごと、家族構成など）を
簡潔に抽出してください。JSON形式で返してください。
例: {"child_age": "3歳", "concerns": ["食事", "睡眠"], "family": "夫婦と子ども1人"}

ユーザー: ${userMessage}
AI: ${aiMessage}
    `.trim();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    
    const raw = completion.choices?.[0]?.message?.content;
    const extractedInfo: string | null = typeof raw === 'string' ? raw.trim() : null;
    if (extractedInfo) {
      // 重要な情報をデータベースに保存（将来の会話で参照可能にする）
      await supabaseAdmin.from('conversation_memories').insert({
        participant_id: participantId,
        user_message: userMessage,
        ai_message: aiMessage,
        extracted_info: extractedInfo,
        created_at: new Date().toISOString()
      });
      console.log(`[Memory] Saved important conversation info for participant ${participantId}`);
    }
  } catch (e) {
    console.error('saveImportantConversationInfo failed', e);
  }
}