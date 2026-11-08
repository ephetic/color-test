export type QuizPair = "blue-green" | "red-orange";

export type BisectionState = {
  pair: QuizPair;
  lo: number;
  hi: number;
  step: number;
};

const RANGES: Record<QuizPair, { lo: number; hi: number; leftLabel: string; rightLabel: string }> =
  {
    /** HSV S=V=1: 120° #00FF00 green → 240° #0000FF blue */
    "blue-green": {
      lo: 120,
      hi: 240,
      leftLabel: "This is blue",
      rightLabel: "This is green",
    },
    /** HSV S=V=1: 359° crimson red → 11° orange (wraps past 0°; less yellow at top) */
    "red-orange": {
      lo: 359,
      hi: 11,
      leftLabel: "This is red",
      rightLabel: "This is orange",
    },
  };

export function pairHueRange(pair: QuizPair): { lo: number; hi: number } {
  const r = RANGES[pair];
  return { lo: r.lo, hi: r.hi };
}

/** Span in degrees along the hue arc (red–orange wraps past 360°). */
export function pairHueSpan(pair: QuizPair): number {
  const { lo, hi } = pairHueRange(pair);
  if (pair === "red-orange" && lo > hi) return 360 - lo + hi;
  return hi - lo;
}

export function startBisection(pair: QuizPair): BisectionState {
  const r = RANGES[pair];
  return { pair, lo: r.lo, hi: r.hi, step: 0 };
}

function midpointHue(lo: number, hi: number, pair: QuizPair): number {
  if (pair === "red-orange" && lo > hi) {
    const span = 360 - lo + hi;
    let mid = lo + span / 2;
    if (mid >= 360) mid -= 360;
    return mid;
  }
  return (lo + hi) / 2;
}

function hueDistance(lo: number, hi: number, pair: QuizPair): number {
  if (pair === "red-orange" && lo > hi) return 360 - lo + hi;
  return Math.abs(hi - lo);
}

export function currentHue(state: BisectionState): number {
  return midpointHue(state.lo, state.hi, state.pair);
}

export function labelsFor(pair: QuizPair): { left: string; right: string } {
  const r = RANGES[pair];
  return { left: r.leftLabel, right: r.rightLabel };
}

/** User tapped the left button (this is blue / this is red). */
export function chooseLeft(state: BisectionState): BisectionState {
  const mid = currentHue(state);
  const narrowHi = state.pair === "blue-green";
  return {
    ...state,
    ...(narrowHi ? { hi: mid } : { lo: mid }),
    step: state.step + 1,
  };
}

/** User tapped the right button (this is green / this is orange). */
export function chooseRight(state: BisectionState): BisectionState {
  const mid = currentHue(state);
  const narrowHi = state.pair === "blue-green";
  return {
    ...state,
    ...(narrowHi ? { lo: mid } : { hi: mid }),
    step: state.step + 1,
  };
}

export function isDone(state: BisectionState, precision = 1.5): boolean {
  return hueDistance(state.lo, state.hi, state.pair) <= precision || state.step >= 12;
}

export function resultHue(state: BisectionState): number {
  return currentHue(state);
}

/** Final bisection bracket — used as a session-level uncertainty band. */
export function resultBounds(state: BisectionState): { lo: number; hi: number } {
  return { lo: state.lo, hi: state.hi };
}

export type QuizResult = {
  id: string;
  pair: QuizPair;
  hueDegrees: number;
  boundsLo: number;
  boundsHi: number;
  steps: number;
  calibrated: boolean;
  calibration: import("./calibration").Calibration;
  at: string;
};

const RESULTS_KEY = "color-test-results-v1";

export function saveResult(result: QuizResult): void {
  const prev = loadResults();
  prev.push(result);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(prev));
}

function normalizeResult(raw: unknown): QuizResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<QuizResult>;
  if (!r.pair || r.hueDegrees == null) return null;
  return {
    id: r.id ?? r.at ?? crypto.randomUUID(),
    pair: r.pair,
    hueDegrees: r.hueDegrees,
    boundsLo: r.boundsLo ?? r.hueDegrees,
    boundsHi: r.boundsHi ?? r.hueDegrees,
    steps: r.steps ?? 0,
    calibrated: r.calibrated ?? false,
    calibration: r.calibration ?? {
      brightness: 0,
      contrast: 1,
      gamma: 1,
    },
    at: r.at ?? new Date().toISOString(),
  };
}

export function loadResults(): QuizResult[] {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeResult).filter((x): x is QuizResult => x != null);
  } catch {
    return [];
  }
}

export function resultsForPair(pair: QuizPair): QuizResult[] {
  return loadResults().filter((r) => r.pair === pair);
}

export function clearResults(): void {
  localStorage.removeItem(RESULTS_KEY);
}
