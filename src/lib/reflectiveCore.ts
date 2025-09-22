import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const SYSTEM = `
あなたは傾聴AI。評価や賞賛は行わず、断片から「物の見方」を柔らかく言語化する。
出力は日本語・最大3文。
1) 観察（事実描写のみ）
2) 仮ラベル（〜な見方／〜を大事にする傾向）
3) つなぎ（選択肢2つ＋自由の誘い、助言ではなく選択）
禁止: すごい/素晴らしい/偉い/完璧/神/尊い 等の評価語。診断語。`;

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
