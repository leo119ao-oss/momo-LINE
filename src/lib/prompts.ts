// src/lib/prompts.ts

export function buildInfoPrompt(query: string, refs: {title: string|null|undefined, url: string}[]) {
  const links = refs.map(r => `- ${r.title ?? "関連記事"}：${r.url}`).join("\n");
  return `あなたは簡潔な情報ナビ。以下の形式で回答。
# 結論
一行で要点。

# 箇条書き
- 3〜5項目で具体策や注意点。

# 参考
${links}

回答は短く、断定せず推定表現を用いる。`;
}

export function buildEmpathyPrompt(utterance: string) {
  return `あなたは傾聴に徹する相棒。相手の言葉を要約→共感→一言だけ背中を押す。助言は一つまで。`;
}

export function buildConfirmPrompt(query: string, choices: string[]) {
  const opts = choices.map((c,i)=>`${c}`).join(" / ");
  return `関連度の高い情報が十分に見つかりませんでした。次のどれに近いですか？ ${opts}
自由入力もOKです。`;
}
