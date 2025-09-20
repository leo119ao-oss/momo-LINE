const FACT_WORDS = ['保育園','幼稚園','買い物','洗濯','食器','発熱','夜泣き','寝かしつけ','雨','電車','仕事','上司','園','病院','夕方','朝','遅刻','スーパー','買い出し','帰宅','風呂','片付け'];

export type InsightGate = { ok: boolean; reason?: string };

export function shouldAddInsightCue(
  userText: string,
  ctx: { hasEmotionSelected?: boolean; hasDeepeningChoice?: boolean; emotion?: string }
): InsightGate {
  const text = (userText || '').trim();
  const charOk = text.length >= 18;
  const sentenceCount = text.split(/[。！？\n]/).filter(s => s.trim()).length;
  const sentenceOk = sentenceCount >= 2;
  const structureOk = !!ctx.hasEmotionSelected && !!ctx.hasDeepeningChoice;
  const hasFact = FACT_WORDS.some(w => text.includes(w));
  const isOneWord = sentenceCount === 0 && text.length <= 8;
  const isJustShortComplain = /^(疲れた|しんどい|つらい|無理|むり|だるい)[！!。]?$/.test(text);
  const peakAnger = ctx.emotion === 'anger';

  if (peakAnger) return { ok: false, reason: 'anger_peak' };
  if (isOneWord || isJustShortComplain) return { ok: false, reason: 'too_short' };
  if (!(hasFact || structureOk)) return { ok: false, reason: 'no_fact' };
  if (!((charOk && sentenceOk) || structureOk)) return { ok: false, reason: 'not_enough' };

  return { ok: true };
}
