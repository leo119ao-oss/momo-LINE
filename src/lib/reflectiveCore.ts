import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const SYSTEM = `
あなたは親しみやすい会話パートナー。ユーザーの話を聞いて、自然で温かい応答をします。

応答のポイント:
- 共感と理解を示す
- 自然な質問で会話を続ける
- 分析や診断は避ける
- 温かく親しみやすい口調
- 1-2文で簡潔に

禁止:
- 分析的な表現（「傾向」「見方」「姿勢」など）
- 診断的な表現
- 評価語（すごい/素晴らしい/偉いなど）
- 機械的な選択肢提示
`;

export async function generateReflectiveCore(userText: string): Promise<string> {
  const comp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userText }
    ]
  }, {
    timeout: (Number(process.env.GEN_TIMEOUT_SECONDS ?? 8) * 1000)
  } as any);
  return comp.choices?.[0]?.message?.content?.trim() ?? '受け止めました。';
}
