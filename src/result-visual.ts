import { calibratedCssColor } from "./color";
import type { Calibration } from "./calibration";
import { pairHueRange, pairHueSpan, type QuizPair } from "./quiz";

/** Unwrap hue onto the quiz arc so 0–100% matches red→orange (not into yellow). */
function hueAlongPairArc(hue: number, pair: QuizPair): number {
  const { lo, hi } = pairHueRange(pair);
  const span = pairHueSpan(pair);
  let h = hue;
  if (pair === "red-orange" && lo > hi && h < lo) h += 360;
  const t = h - lo;
  return (Math.min(span, Math.max(0, t)) / span) * 100;
}

/** Position along the bar in percent (0–100). */
export function hueToBarPercent(hue: number, pair: QuizPair): number {
  const { lo, hi } = pairHueRange(pair);
  const span = pairHueSpan(pair);
  if (pair === "red-orange" && lo > hi) return hueAlongPairArc(hue, pair);
  const t = hue - lo;
  return (Math.min(span, Math.max(0, t)) / span) * 100;
}

function pairGradientEndHues(pair: QuizPair): { lo: number; hi: number } {
  const { lo } = pairHueRange(pair);
  const span = pairHueSpan(pair);
  let hi = lo + span;
  if (hi >= 360) hi -= 360;
  return { lo, hi };
}

export function pairGradientEndColors(
  pair: QuizPair,
  cal: Calibration,
): { start: string; end: string } {
  const { lo, hi } = pairGradientEndHues(pair);
  return {
    start: calibratedCssColor(lo, 1, 1, cal),
    end: calibratedCssColor(hi, 1, 1, cal),
  };
}

export function pairGradientCss(pair: QuizPair, cal: Calibration): string {
  const steps = 32;
  const { lo, hi } = pairGradientEndHues(pair);
  const span = pairHueSpan(pair);
  const start = calibratedCssColor(lo, 1, 1, cal);
  const end = calibratedCssColor(hi, 1, 1, cal);
  const stops: string[] = [`${start} 0%`, `${start} 0.25%`];
  for (let i = 1; i < steps; i++) {
    let h = lo + (span * i) / steps;
    if (h >= 360) h -= 360;
    const pct = (100 * i) / steps;
    stops.push(`${calibratedCssColor(h, 1, 1, cal)} ${pct.toFixed(2)}%`);
  }
  stops.push(`${end} 99.75%`, `${end} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export type PairCiBarOptions = {
  boundsLo?: number;
  boundsHi?: number;
  pastHues?: number[];
  /** Mark the latest run (e.g. on the result screen) with an upward triangle. */
  latestHue?: number;
  muted?: boolean;
  /** Reserve bracket and dot rows even when empty (home cards). */
  fixedLayout?: boolean;
};

function boundParen(ch: "(" | ")"): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "ci-bracket-paren";
  el.textContent = ch;
  return el;
}

function appendBracketRow(
  bracket: HTMLElement,
  pair: QuizPair,
  boundsLo: number,
  boundsHi: number,
) {
  bracket.setAttribute(
    "aria-label",
    `${boundsLo.toFixed(1)}° to ${boundsHi.toFixed(1)}°`,
  );

  const loPct = hueToBarPercent(boundsLo, pair);
  const hiPct = hueToBarPercent(boundsHi, pair);

  const loMark = document.createElement("span");
  loMark.className = "ci-mark lo";
  loMark.style.left = `${loPct}%`;

  const loLabel = document.createElement("span");
  loLabel.className = "ci-bound-label";
  loLabel.textContent = `${boundsLo.toFixed(1)}°`;

  loMark.append(loLabel, boundParen("("));

  const hiMark = document.createElement("span");
  hiMark.className = "ci-mark hi";
  hiMark.style.left = `${hiPct}%`;

  const hiLabel = document.createElement("span");
  hiLabel.className = "ci-bound-label";
  hiLabel.textContent = `${boundsHi.toFixed(1)}°`;

  hiMark.append(boundParen(")"), hiLabel);

  bracket.append(loMark, hiMark);
}

export function buildPairCiBar(
  pair: QuizPair,
  cal: Calibration,
  options: PairCiBarOptions = {},
): HTMLElement {
  const wrap = document.createElement("div");
  const classes = ["ci-bar-chart"];
  if (options.muted) classes.push("muted");
  if (options.fixedLayout) classes.push("layout-fixed");
  wrap.className = classes.join(" ");

  const stack = document.createElement("div");
  stack.className = "ci-bar-stack";

  const bar = document.createElement("div");
  bar.className = "ci-gradient-bar";
  const { start, end } = pairGradientEndColors(pair, cal);
  bar.style.setProperty("--grad-start", start);
  bar.style.setProperty("--grad-end", end);
  const fill = document.createElement("div");
  fill.className = "ci-gradient-fill";
  fill.style.background = pairGradientCss(pair, cal);
  bar.append(fill);
  stack.append(bar);

  const overlay = document.createElement("div");
  overlay.className = "ci-bar-overlay";

  const pastHues = options.pastHues ?? [];
  const hasSession = options.boundsLo != null && options.boundsHi != null;
  const showBracket = hasSession || options.fixedLayout;
  const showDots = pastHues.length > 0 || options.fixedLayout;

  if (showBracket) {
    const bracket = document.createElement("div");
    bracket.className = "ci-bracket";
    if (hasSession) {
      appendBracketRow(bracket, pair, options.boundsLo!, options.boundsHi!);
    }
    overlay.append(bracket);
  }

  if (showDots) {
    const dots = document.createElement("div");
    dots.className = "ci-dots";
    const latestHue = options.latestHue;
    pastHues.forEach((h, i) => {
      if (latestHue != null && i === pastHues.length - 1) return;
      const dot = document.createElement("span");
      dot.className = "ci-dot";
      dot.style.left = `${hueToBarPercent(h, pair)}%`;
      dot.title = `${h.toFixed(1)}°`;
      dots.append(dot);
    });
    if (latestHue != null) {
      const tri = document.createElement("span");
      tri.className = "ci-dot-latest";
      tri.style.left = `${hueToBarPercent(latestHue, pair)}%`;
      tri.title = `${latestHue.toFixed(1)}° (latest)`;
      dots.append(tri);
    }
    overlay.append(dots);
  }

  if (overlay.childElementCount > 0) {
    stack.append(overlay);
  }
  wrap.append(stack);

  return wrap;
}
