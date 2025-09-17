// src/lib/style/reflective.ts

/**
 * 傾聴スタイルのガード機能
 * 評価語や診断語の使用を防ぐ
 */

/**
 * 禁止語チェック
 * @param text チェック対象のテキスト
 * @returns 禁止語が含まれていない場合はtrue
 */
export const reflectiveGuard = (text: string): boolean => {
  const banned = /(すごい|素晴らしい|偉い|完璧|神|尊い)/;
  return !banned.test(text);
};

/**
 * 傾聴スタイルの品質チェック
 * @param output 出力テキスト
 * @returns 品質メタデータ
 */
export const checkReflectiveQuality = (output: string) => {
  const praise = (output.match(/すごい|素晴らしい|偉い|完璧|神|尊い/g) || []).length;
  const hasLabel = /見方|傾向/.test(output);
  const sentences = output.split(/[。！？]/).filter(s => s.trim().length > 0);
  const isWithin3Sentences = sentences.length <= 3;
  const hasQuestion = /[？?]/.test(output);
  
  return {
    praise_count: praise,
    has_label: hasLabel,
    sentence_count: sentences.length,
    is_within_3_sentences: isWithin3Sentences,
    has_question: hasQuestion,
    length: output.length
  };
};

/**
 * 診断語チェック
 * @param text チェック対象のテキスト
 * @returns 診断語が含まれていない場合はtrue
 */
export const checkNoDiagnosis = (text: string): boolean => {
  const diagnosisTerms = /(臨床的|診断|障害|症候群|病的|異常|問題)/;
  return !diagnosisTerms.test(text);
};
