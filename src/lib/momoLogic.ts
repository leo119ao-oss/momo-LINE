// import { supabase } from './supabaseClient';
import { supabaseAdmin } from './supabaseAdmin';
import OpenAI from 'openai';

async function wpFallbackSearch(query: string, limit = 5) {
  try {
    const url = new URL('https://www.okaasan.net/wp-json/wp/v2/posts');
    url.searchParams.set('search', query);
    url.searchParams.set('per_page', String(limit));
    url.searchParams.set('_fields', 'link,title,excerpt');

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) return [];
    const posts: any[] = await res.json();

    return posts.map(p => ({
      url: p.link as string,
      title: (p.title?.rendered ?? '').replace(/<[^>]*>/g, ''),
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

/**
 * @JSDoc
 * 【新規追加】ユーザーのメッセージの意図を判別する「受付係」AI。
 * @param userMessage ユーザーからのテキストメッセージ
 * @returns 'information_seeking' (情報探索) または 'personal_reflection' (内省的なつぶやき)
 */
async function detectUserIntent(userMessage: string): Promise<UserIntent> {
  const quickAskRegex = /[？\?]|(どう|教えて|方法|何|どこ|いつ|おすすめ|使い方)/;
  if (quickAskRegex.test(userMessage)) return 'information_seeking';
  
  const prompt = `
    以下のユーザーメッセージが、「具体的な情報を求める質問」か「自身の感情や出来事についての内省的なつぶやき」かを分類してください。
    
    質問の例：
    - 「〜の方法を教えて」
    - 「〜について知りたい」
    - 「〜はどうすればいい？」
    - 「あなたは何ができるの？」
    - 「〜のコツは？」
    
    つぶやきの例：
    - 「疲れた〜」
    - 「今日は大変だった」
    - 「なんだか悲しい」
    - 「うれしい」
    
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
 * @returns AIが生成した回答と引用元URL
 */
async function handleInformationSeeking(userMessage: string): Promise<string> {
  console.log('Handling information seeking intent...');
  try {
    // 1. 質問をベクトル化
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userMessage,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Supabase DBから関連情報を検索 (SQLで作成した関数を呼び出す)
    const { data: documents, error } = await supabaseAdmin.rpc('match_documents_arr', {
      query_embedding: queryEmbedding, // number[]
      match_count: 8
    });

    if (error) throw new Error(`Supabase search error: ${error.message}`);
    
    // documents には similarity を含む前提（match_documents_arr）
    const MIN_SIM = 0.25; // 日本語×smallモデルなら 0.2〜0.35 が現実的
    const filtered = (documents ?? []).filter((d: any) => (d.similarity ?? 0) >= MIN_SIM);
    const picked = (filtered.length ? filtered : (documents ?? [])).slice(0, 3);

    // ここまでで picked.length が0ならフォールバック
    if (picked.length === 0) {
      const wp = await wpFallbackSearch(userMessage, 5);
      if (wp.length) {
        const list = wp.map((p, i) => `[${i+1}] ${p.title}\n${p.url}`).join('\n');
        return `手元のベクトル検索では直接ヒットがなかったけど、近いテーマっぽい記事を見つけたよ。\n\n— 参考候補 —\n${list}`;
      }
      return 'ごめん、いま手元のデータからは関連が拾えなかった… もう少し違う聞き方も試してみて？';
    }

    const contextText = picked.map((d: any) => d.content).join('\n---\n');
    const sourceUrls = Array.from(new Set(picked.map((d: any) => d.source_url)));

    const systemPrompt = `
      あなたは「okaasan.net」の知識を持つ、温かく親しみやすい相談相手です。
      提供されたコンテキスト情報に基づいて、ユーザーの質問に自然で親しみやすい日本語で回答してください。
      
      応答のスタイル：
      - 温かく親しみやすい口調で
      - 必要以上に堅苦しくならない
      - ユーザーの気持ちに寄り添う
      - コンテキストにない情報は「すみません、そのことについては詳しくわからないのですが...」と自然に伝える
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `コンテキスト:\n${contextText}\n\n質問: ${userMessage}` },
      ],
    });

    const answer = completion.choices[0].message.content || 'すみません、うまくお答えできませんでした。';
    
    // 引用の体裁を整える（番号付き）
    const refs = sourceUrls.map((u, i) => `[${i+1}] ${u}`).join('\n');
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
  const intent = await detectUserIntent(text);
  let aiMessage: string;

  if (intent === 'information_seeking') {
    // 【質問の場合】RAG処理を呼び出す
    aiMessage = await handleInformationSeeking(text);
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

    const systemPrompt = `
      あなたはMomo AIパートナー。母親であるユーザーの内省を支援する、温かく親しみやすい存在です。
      
      あなたの役割：
      - ユーザーの話を温かく受け止め、共感を示す
      - 質問責めではなく、自然な会話の流れを作る
      - ユーザーが話したいことを自由に話せる環境を作る
      
      応答のスタイル：
      - 「そうなんだね」「うんうん」「なるほど」など、相づちを多用する
      - 質問は最小限に留め、ユーザーが自発的に話したくなるような雰囲気を作る
      - ユーザーの感情に寄り添い、そのまま受け止める
      - 必要以上に深く掘り下げようとせず、ユーザーのペースに合わせる
      
      避けるべきこと：
      - 連続した質問
      - 評価や判断
      - 安易なアドバイスや励まし
      - 話を遮ること
      
      自然な会話例：
      「疲れた〜」→「お疲れさま。ゆっくり休んでね」
      「今日は大変だった」→「そうだったんだね。お疲れさま」
      「子どもが言うことを聞かなくて」→「うんうん、そういう時もあるよね」
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    aiMessage = completion.choices[0].message.content || 'うんうん、そうなんだね。';
  }

  // AIの応答をログに保存
  await supabaseAdmin.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'assistant',
    content: aiMessage,
  });

  return aiMessage;
}