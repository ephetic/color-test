import type { QuizPair } from "./quiz";

/** Mean hue in degrees, handling wrap for red–orange cluster near 0°. */
export function meanHue(hues: number[], pair: QuizPair): number {
  if (hues.length === 0) return NaN;
  if (pair === "red-orange") {
    const rad = hues.map((h) => (h * Math.PI) / 180);
    const sx = rad.reduce((s, r) => s + Math.cos(r), 0);
    const sy = rad.reduce((s, r) => s + Math.sin(r), 0);
    let deg = (Math.atan2(sy, sx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }
  return hues.reduce((a, b) => a + b, 0) / hues.length;
}

function tCritical95(df: number): number {
  const table: Record<number, number> = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    15: 2.131,
    20: 2.086,
    30: 2.042,
  };
  if (df <= 0) return 0;
  if (df >= 30) return 1.96;
  return table[df] ?? 2.0;
}

export type AggregateCI = {
  mean: number;
  low: number;
  high: number;
  std: number;
  n: number;
};

/** 95% CI for the mean threshold across repeated sessions (n ≥ 2). */
export function aggregateCi95(hues: number[], pair: QuizPair): AggregateCI | null {
  const n = hues.length;
  if (n === 0) return null;
  if (n === 1) {
    return { mean: hues[0]!, low: hues[0]!, high: hues[0]!, std: 0, n: 1 };
  }
  const m = meanHue(hues, pair);
  const deviations = hues.map((h) => {
    if (pair === "red-orange") {
      let d = h - m;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return d;
    }
    return h - m;
  });
  const variance = deviations.reduce((s, d) => s + d * d, 0) / (n - 1);
  const std = Math.sqrt(variance);
  const se = std / Math.sqrt(n);
  const t = tCritical95(n - 1);
  return {
    mean: m,
    low: m - t * se,
    high: m + t * se,
    std,
    n,
  };
}

export function formatBounds(lo: number, hi: number, pair: QuizPair): string {
  if (pair === "red-orange" && lo > hi) {
    return `${lo.toFixed(1)}° – ${hi.toFixed(1)}° (wrap)`;
  }
  return `${Math.min(lo, hi).toFixed(1)}° – ${Math.max(lo, hi).toFixed(1)}°`;
}
