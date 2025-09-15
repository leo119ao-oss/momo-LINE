// import { supabase } from './supabaseClient';
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';
import { searchArticles } from './search';
import type { RagHit } from './rag';
import { buildInfoPrompt, buildEmpathyPrompt, buildConfirmPrompt } from './prompts';
import { oneLineWhy } from './rag';
import { appRev } from './log';
import { slugify } from './slug';

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

  // 参考記事ブロック生成（新しい構造では不要）
  return '';
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
function analyzeConversationFlow(logs: any[]) {
  const userMessages = logs.filter(l => l.role === 'user').slice(-3); // 直近3つのユーザーメッセージ
  const aiMessages = logs.filter(l => l.role === 'assistant').slice(-3); // 直近3つのAIメッセージ
  
  // 会話のテーマを抽出
  const themes = userMessages.map(msg => extractTheme(msg.content)).filter(Boolean);
  const lastTheme = themes[themes.length - 1];
  
  // 会話の深さを判定
  const isDeepConversation = userMessages.length >= 2 && 
    userMessages.some(msg => msg.content.length > 20);
  
  // 会話の文脈をより詳細に分析
  const conversationContext = {
    hasUnclearResponses: userMessages.some(msg => 
      /^(はそう|そう|うん|はい|いいえ|わからない|知らない|何|なに|どう|なぜ|どうして|あの|えー|うーん|んー|そうですね|それ|これ|あれ|どれ)$/i.test(msg.content.trim())
    ),
    averageMessageLength: userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length,
    lastMessageLength: userMessages[userMessages.length - 1]?.content.length || 0,
    conversationDepth: userMessages.length,
    hasQuestions: userMessages.some(msg => /[？\?]/.test(msg.content)),
    hasEmotionalWords: userMessages.some(msg => 
      /(疲れ|イライラ|不安|心配|楽しい|嬉しい|悲しい|困る|悩み)/.test(msg.content)
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
async function askForClarification(q: string): Promise<string> {
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
async function checkForClarification(userMessage: string, conversationContext: any): Promise<string | null> {
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
    `前回のテーマ: ${conversationContext.lastTheme || '新しい話題'}\n前回のAI応答: ${conversationContext.lastAiMessage}` : 
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
async function handleInformationSeeking(participant: any, userMessage: string): Promise<string> {
  console.log('Handling information seeking intent...');
  try {
    // 新しいRAG検索を使用
    const hits = await searchArticles(userMessage);
    
    // 低確度の場合は確認質問にフォールバック
    if (hits.length === 0) {
      return buildConfirmPrompt(userMessage, [
        "A) もう少しレシピの基本が知りたい",
        "B) 今日作れる代替案を提案してほしい"
      ]);
    }

    const { lastUser, thread: recentThread, conversationFlow } = await getConversationContext(participant.id);
    
    // 不明確なメッセージの場合は聞き返しを優先
    const clarificationResponse = await checkForClarification(userMessage, conversationFlow);
    if (clarificationResponse) {
      return clarificationResponse;
    }
    
    // 会話の継続性を考慮したシステムプロンプト
    const contextInfo = conversationFlow.isDeepConversation ? 
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
 * 【変更】メインのメッセージ処理関数。意図判別に応じて処理を振り分ける。
 */
export async function handleTextMessage(userId: string, text: string): Promise<string> {
  // バージョンログ（本番確認用）
  console.log('[APP]', 'rev=', appRev());
  
  const participant = await findOrCreateParticipant(userId);

  // ユーザーメッセージをログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'user',
    content: text,
  });

  // 未回答の画像があればキャプション確定（最優先）
  const { data: pendings } = await supabaseAdmin
    .from('media_entries')
    .select('*')
    .eq('participant_id', participant.id)
    .eq('status', 'awaiting')
    .order('created_at', { ascending: false })
    .limit(1);

  if (pendings && pendings.length) {
    const p = pendings[0];

    if (p.ask_stage === 1) {
      // 候補のどれ？ or 自由文？
      const choices: string[] = (() => { 
        try { 
          return JSON.parse(p.suggested_caption || '[]'); 
        } catch { 
          return []; 
        }
      })();
      
      let finalCap = text.trim();
      const m = text.trim().match(/^[１２３1-3]$/);
      
      if (m) {
        // 番号選択の場合
        const idx = Number(m[0].replace('１','1').replace('２','2').replace('３','3')) - 1;
        if (choices[idx]) finalCap = choices[idx];
      } else {
        // 自由文を"日記向けに整形"
        const openai = new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY! });
        const norm = await openai.chat.completions.create({
          model: 'gpt-4o-mini', 
          temperature: 0.4,
          messages: [
            { role: 'system', content: '入力文を日記のキャプションらしく20±6字で自然に整える。絵文字・記号・引用符なし。' },
            { role: 'user', content: text }
          ]
        });
        finalCap = norm.choices[0].message.content?.trim() || text;
      }

      await supabaseAdmin.from('media_entries')
        .update({ caption: finalCap, ask_stage: 2 })
        .eq('id', p.id);

      return `いいね。「${finalCap}」でどうかな？\nもう少しだけ教えて：その瞬間、どんな気持ちだった？一言メモにするよ。`;
    }

    if (p.ask_stage === 2) {
      // ひとことメモ保存 → 完成 → slug 発行 → URL 返す
      const slug = p.page_slug || slugify(p.caption || 'diary');

      await supabaseAdmin.from('media_entries')
        .update({ 
          extra_note: text.trim(), 
          page_slug: slug, 
          status: 'done', 
          ask_stage: 3 
        })
        .eq('id', p.id);

      const url = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/,'') || ''}/diary/${slug}`;
      return `できたよ。\n「${p.caption || ''}${p.caption ? '／' : ''}${text.trim()}」\n絵日記ページ：\n${url}\n（必要ならあとで文言を送ってくれれば更新もできるよ）`;
    }
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
  
  // デバッグ用：意図検出の詳細ログ
  console.log(`[Debug] Intent detection - Text: "${text}", Raw: ${rawIntent}, Final: ${intent}`);
  
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
      .limit(12); // より多くの会話履歴を取得
    
    const messages = (history || [])
      .reverse()
      .map(log => ({
        role: log.role === 'ai' ? 'assistant' : 'user',
        content: log.content
      })) as { role: 'user' | 'assistant'; content: string }[];

    // 現在のユーザーメッセージを追加
    messages.push({ role: 'user', content: text });

    // 会話の流れを分析
    const { conversationFlow } = await getConversationContext(participant.id);
    
    // 不明確なメッセージの場合は聞き返しを優先
    const clarificationResponse = await checkForClarification(text, conversationFlow);
    if (clarificationResponse) {
      return clarificationResponse;
    }
    
    const profile = participant.profile_summary ? `\n[ユーザープロフィール要約]\n${participant.profile_summary}\n` : '';
    
    // 会話の継続性を考慮したシステムプロンプト
    const conversationContext = conversationFlow.isDeepConversation ? 
      `\n[会話の流れ]\n前回のテーマ: ${conversationFlow.lastTheme || '新しい話題'}\n会話の深さ: ${conversationFlow.messageCount}回のやり取り\n前回のAI応答: ${conversationFlow.lastAiMessage}` : '';
    
    const reflectionSystem = `
${MOMO_VOICE}${profile}${conversationContext}

[ルール]
- 会話の流れを意識し、前回の内容に自然に繋げる。
- 過去の会話について聞かれた場合は、具体的に振り返って答える。
- 相づち→ねぎらい→一息つける提案を1つだけ。
- 連続質問はしない。問いは最大1つ。
- ユーザーの表現を少し言い換えて返す（ミラーリング）。
- 会話が続いている場合は、前回の話題に関連した自然なフォローアップを心がける。
- ユーザーが具体的な解決策や情報を求めている場合は、「詳しい情報が必要だったら教えてね」と提案する。
- 内容が不明確な場合は、推察を交えつつ具体的に聞き返す。
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
  
  // 重要な会話情報を記憶に保存（ベストエフォート）
  saveImportantConversationInfo(participant.id, text, aiMessage).catch(console.error);

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