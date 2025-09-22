const FACT_WORDS = ['保育園','幼稚園','買い物','洗濯','食器','発熱','夜泣き','寝かしつけ','雨','電車','仕事','上司','園','病院','夕方','朝','遅刻','スーパー','買い出し','帰宅','風呂','片付け'];

export type InsightGate = { ok: boolean; reason?: string };

export function shouldAddInsightCue(
  userText: string,
  ctx: { hasEmotionSelected?: boolean; hasDeepeningChoice?: boolean; emotion?: string }
): InsightGate {
  const text = (userText || '').trim();
  const isTooShort = text.length <= 5;
  const isJustEmoji = /^[\uD83C-\uDBFF\uDC00-\uDFFF]+$/.test(text);
  const peakAnger = ctx.emotion === 'anger';

  // 基本的な条件のみで判断（より自然に共感を追加）
  if (isTooShort || isJustEmoji) return { ok: false, reason: 'too_short' };
  if (peakAnger) return { ok: false, reason: 'anger_peak' };

  return { ok: true };
}
