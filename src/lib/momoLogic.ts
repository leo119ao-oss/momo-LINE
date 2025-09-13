import { supabase } from './supabaseClient';
import OpenAI from 'openai';

// JSDoc: クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// JSDoc: ユーザー情報を取得または作成する関数
async function findOrCreateParticipant(lineUserId: string) {
  // ... (この部分は変更ありません)
  let { data: participant } = await supabase
    .from('participants')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  if (!participant) {
    const { data: newParticipant, error } = await supabase
      .from('participants')
      .insert({ line_user_id: lineUserId, archetype: 'B' })
      .select()
      .single();
    
    if (error) throw error;
    participant = newParticipant;
  }
  return participant;
}

// ---ここからが新しいロジックです---

type UserIntent = 'information_seeking' | 'personal_reflection';

/**
 * @JSDoc
 * 【新規追加】ユーザーのメッセージの意図を判別する「受付係」AI。
 * @param userMessage ユーザーからのテキストメッセージ
 * @returns 'information_seeking' (情報探索) または 'personal_reflection' (内省的なつぶやき)
 */
async function detectUserIntent(userMessage: string): Promise<UserIntent> {
  const prompt = `
    以下のユーザーメッセージが、「具体的な情報を求める質問」か「自身の感情や出来事についての内省的なつぶやき」かを分類してください。
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
    console.log('Intent detection result:', result); // ★この行を追加！
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
    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.75, // 類似度の閾値
      match_count: 3,         // 最大3件のチャンクを取得
    });

    if (error) throw new Error(`Supabase search error: ${error.message}`);
    if (!documents || documents.length === 0) {
      return 'ごめんなさい、その質問に関連する情報が私の知識の中に見つかりませんでした。';
    }

    // 3. 取得した情報をコンテキストとして回答を生成
    const contextText = documents.map((d: any) => d.content).join('\n---\n');
    const sourceUrls = Array.from(new Set(documents.map((d: any) => d.source_url)));

    const systemPrompt = `
      あなたは「okaasan.net」の知識を持つ、賢く優しい相談相手です。
      提供されたコンテキスト情報にのみ基づいて、ユーザーの質問に日本語で回答してください。
      コンテキストにない情報は「わかりません」と答えてください。
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `コンテキスト:\n${contextText}\n\n質問: ${userMessage}` },
      ],
    });

    const answer = completion.choices[0].message.content || 'すみません、うまくお答えできませんでした。';
    
    // 4. 回答に引用元URLを付与
    return `${answer}\n\n【参考記事】\n${sourceUrls.join('\n')}`;

  } catch (error) {
    console.error('RAG process failed:', error);
    return '申し訳ありません、情報の検索中にエラーが発生しました。';
  }
}

/**
 * @JSDoc
 * 【変更】メインのメッセージ処理関数。意図判別に応じて処理を振り分ける。
 */
export async function handleTextMessage(userId: string, text: string): Promise<string> {
  const participant = await findOrCreateParticipant(userId);

  // ユーザーメッセージをログに保存
  await supabase.from('chat_logs').insert({
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
    const { data: history } = await supabase
      .from('chat_logs')
      .select('role, content')
      .eq('participant_id', participant.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const messages = (history || [])
      .reverse()
      .map(log => ({
        role: log.role === 'ai' ? 'assistant' : 'user',
        content: log.content
      })) as { role: 'user' | 'assistant'; content: string }[];

    const systemPrompt = `
      あなたはMomo AIパートナー。母親であるユーザーの内省を支援する、熟練したカウンセラーです...
      (このプロンプトは変更ありません)
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    aiMessage = completion.choices[0].message.content || 'うんうん、そうなんだね。';
  }

  // AIの応答をログに保存
  await supabase.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'assistant',
    content: aiMessage,
  });

  return aiMessage;
}