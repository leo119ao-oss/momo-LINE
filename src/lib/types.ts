/**
 * 型安全ユーティリティ - 段階的にany→unknownへ差し替える土台
 */

// JSON型の定義（再帰的）
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/**
 * 値がRecord<string, unknown>型かチェック
 */
export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * オブジェクトから文字列値を安全に取り出す
 */
export function pickStr(obj: unknown, key: string): string | undefined {
  if (isRecord(obj) && typeof obj[key] === 'string') return obj[key] as string;
  return undefined;
}

/**
 * オブジェクトから数値を安全に取り出す
 */
export function pickNum(obj: unknown, key: string): number | undefined {
  if (isRecord(obj) && typeof obj[key] === 'number' && Number.isFinite(obj[key] as number)) {
    return obj[key] as number;
  }
  return undefined;
}

/**
 * オブジェクトから配列を安全に取り出す
 */
export function pickArray<T>(obj: unknown, key: string): T[] | undefined {
  if (isRecord(obj) && Array.isArray(obj[key])) {
    return obj[key] as T[];
  }
  return undefined;
}

/**
 * ネストしたオブジェクトから値を安全に取り出す
 */
export function pickNested(obj: unknown, ...keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (isRecord(current)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * WordPress APIのtitle.renderedパターンに対応
 */
export function extractTitle(obj: unknown): string | undefined {
  // パターン1: { title: "..." }
  const directTitle = pickStr(obj, 'title');
  if (directTitle) return directTitle;
  
  // パターン2: { title: { rendered: "..." } }
  const titleObj = pickNested(obj, 'title');
  if (isRecord(titleObj)) {
    return pickStr(titleObj, 'rendered');
  }
  
  return undefined;
}

/**
 * 配列の最初の要素を安全に取得
 */
export function first<T>(arr: T[] | undefined): T | undefined {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : undefined;
}

/**
 * 文字列を安全にトリム
 */
export function safeTrim(str: unknown): string {
  return typeof str === 'string' ? str.trim() : '';
}

/**
 * 数値を安全に変換（toNumberの代替）
 */
export function safeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
