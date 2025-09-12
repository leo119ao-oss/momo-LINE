import { supabase } from './supabaseClient';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function findOrCreateParticipant(lineUserId: string) {
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

export async function handleTextMessage(userId: string, text: string): Promise<string> {
  const participant = await findOrCreateParticipant(userId);

  await supabase.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'user',
    content: text,
  });

  const { data: history } = await supabase
    .from('chat_logs')
    .select('role, content')
    .eq('participant_id', participant.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const messages = (history || [])
    .reverse()
    .map(log => ({ 
      role: log.role === 'ai' ? 'assistant' : log.role as 'user' | 'assistant', 
      content: log.content 
    }));

  const systemPrompt = `
    あなたはMomo AIパートナー。母親であるユーザーの内省を支援する、熟練したカウンセラーです。
    あなたの目的は、ただ話を聞き、共感し、ユーザーが自分自身の言葉で感情や思考を整理できるよう、優しく問いかけることです。
    - 決して評価や判断をしないでください。
    - 安易なアドバイスや励ましは避けてください。
    - ユーザーの話を遮らず、深い傾聴を心がけてください。
    - ユーザーが内省を深められるような、開かれた質問を投げかけてください。
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
  });

  const aiMessage = completion.choices[0].message.content || 'すみません、うまくお答えできませんでした。';

  await supabase.from('chat_logs').insert({
    participant_id: participant.id,
    role: 'assistant',
    content: aiMessage,
  });

  return aiMessage;
}
