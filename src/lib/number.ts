/**
 * TypeScriptで安全に数値化するユーティリティ
 */

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toInteger(value: string | number | null | undefined): number {
  return Math.floor(toNumber(value));
}

export function toPositiveNumber(value: string | number | null | undefined): number {
  const n = toNumber(value);
  return n >= 0 ? n : 0;
}

export function toPercentage(value: string | number | null | undefined, decimals: number = 1): number {
  const n = toNumber(value);
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
