// import { supabase } from './supabaseClient';
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';

// 共通のMomoボイス定義
const MOMO_VOICE = `
あなたはMomo。母親の内省を支える温かい相手。
- 口調: やさしく、ねぎらい/共感を一言そえる（〜だね/〜かもね）。
- 断定や評価は避け、「〜かも」「〜してみる？」の提案。
- 長文にしすぎない。段落を分けて読みやすく。
`.trim();

// タイトルと著者名を遅延取得するヘルパー関数
async function fillTitleAuthorIfMissing(hit: any) {
  if (hit.title && hit.author_name) return hit;
  try {
    const api = new URL('https://www.okaasan.net/wp-json/wp/v2/posts');
    api.searchParams.set('search', hit.source_url);
    api.searchParams.set('per_page', '1');
    api.searchParams.set('_embed', 'author');
    const r = await fetch(api.toString());
    if (!r.ok) return hit;
    const [p] = await r.json();
    const clean = (s: string) => s?.replace?.(/<[^>]*>/g, '')?.trim?.() ?? '';
    const title = clean(p?.title?.rendered) || hit.title;
    const author = p?._embedded?.author?.[0]?.name || hit.author_name || 'お母さん大学';
    hit.title = title; hit.author_name = author;

    // ベストエフォートでDBにも保存（将来のため）
    try {
      const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
      await supabaseAdmin.from('documents')
        .update({ title, author_name: author })
        .eq('source_url', hit.source_url);
    } catch {}
  } catch {}
  return hit;
}

// 会話ログを取得するヘルパー関数
async function getRecentThread(participantId: number) {
  const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
  const { data: logs } = await supabaseAdmin
    .from('chat_logs')
    .select('role, content')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: false })
    .limit(8);
  return (logs ?? []).reverse()
    .map(l => `${l.role === 'user' ? 'U' : 'AI'}: ${l.content}`).join('\n');
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

async function wpFallbackSearch(query: string, limit = 5) {
  try {
    const url = new URL('https://www.okaasan.net/wp-json/wp/v2/posts');
    url.searchParams.set('search', query);
    url.searchParams.set('per_page', String(limit));
    url.searchParams.set('_embed', 'author'); // 著者名を埋め込む

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) return [];
    const posts: any[] = await res.json();

    const sanitize = (s: string) => s.replace(/<[^>]*>/g, '').trim();
    return posts.map(p => ({
      url: p.link as string,
      title: sanitize(p.title?.rendered ?? ''),
      author: String(p?._embedded?.author?.[0]?.name ?? 'お母さん大学'),
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
 * @param userMessage ユーザーからの質問
 * @param participant 参加者情報（会話履歴取得用）
 * @returns AIが生成した回答と引用元URL
 */
async function handleInformationSeeking(userMessage: string, participant: any): Promise<string> {
  console.log('Handling information seeking intent...');
  try {
    // 会話コンテキストを取得
    const { lastUser, thread } = await getConversationContext(participant.id);
    // 1st try: 元のクエリでベクトル検索
    let queryText = userMessage;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Supabase DBから関連情報を検索 (SQLで作成した関数を呼び出す)
    const { data: documents, error } = await supabaseAdmin.rpc('match_documents', {
      query_embedding: queryEmbedding, // number[]
      match_count: 8,
      match_threshold: 0.1
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
        const { data: docs2 } = await supabaseAdmin.rpc('match_documents', {
          query_embedding: emb2.data[0].embedding, match_count: 8, match_threshold: 0.1
        });
        docs = docs2 ?? [];
      }
    }
    
    // documents には similarity を含む前提（match_documents_arr）
    const MIN_SIM = 0.15; // NotebookLMレベルの自由度: より低い閾値で関連記事を取得
    const filtered = docs.filter((d: any) => (d.similarity ?? 0) >= MIN_SIM);
    const picked = (filtered.length ? filtered : docs).slice(0, 5); // より多くの記事を返す
    console.log(`[RAG] after_filter: ${filtered.length}, picked: ${picked.length}`);

    // タイトルと著者名を遅延取得
    for (let i = 0; i < picked.length; i++) {
      picked[i] = await fillTitleAuthorIfMissing(picked[i]);
    }

    // ここまでで picked.length が0ならフォールバック
    if (picked.length === 0) {
      const wp = await wpFallbackSearch(userMessage, 5);
      if (wp.length) {
        const list = wp.map((p, i) => `[${i+1}] ${p.title} — ${p.author}\n${p.url}`).join('\n');
        return `手元のベクトル検索では直接ヒットがなかったけど、近いテーマっぽい記事を見つけたよ。\n\n— 参考候補 —\n${list}`;
      }
      return 'ごめん、いま手元のデータからは関連が拾えなかった… もう少し違う聞き方も試してみて？';
    }

    const contextText = picked.map((d: any) => d.content).join('\n---\n');
    const sourceUrls = Array.from(new Set(picked.map((d: any) => d.source_url)));

    const thread = await getRecentThread(participant.id);
    const systemPrompt = `
${MOMO_VOICE}

[最近の会話ログ]
${thread}

[ルール]
1) 冒頭に1〜2文だけ共感を添える（過度な深掘りはしない）。
2) 次に、提供されたコンテキストの範囲で質問に答える。
3) 断定は避け、「〜かも」「〜という考え方も」で柔らかく。
4) 箇条書きOK。最後に一言だけ励ます。
5) コンテキスト外は無理に答えない。
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
    
    // 引用の体裁を整える（番号＋タイトル — 著者＋URL）
    const refs = picked.map((d: any, i: number) =>
      `[${i+1}] ${d.title ?? '(タイトル未取得)'} — ${d.author_name ?? 'お母さん大学'}\n${d.source_url}`
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
  const participant = await findOrCreateParticipant(userId);

  // ユーザーメッセージをログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'user',
    content: text,
  });

  // ユーザーの意図を判別
  const rawIntent = await detectUserIntent(text);
  const intent = chooseMode(rawIntent, text);
  lastMode = intent;
  console.log(`[Intent] User message: "${text}" -> Raw: ${rawIntent} -> Final: ${intent}`);
  let aiMessage: string;

  if (intent === 'information_seeking') {
    // 【質問の場合】RAG処理を呼び出す
    aiMessage = await handleInformationSeeking(text, participant);
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