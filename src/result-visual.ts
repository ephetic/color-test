import { calibratedCssColor } from "./color";
import type { Calibration } from "./calibration";
import type { QuizPair } from "./quiz";

const RANGE: Record<QuizPair, { lo: number; hi: number }> = {
  "blue-green": { lo: 120, hi: 240 },
  "red-orange": { lo: 350, hi: 50 },
};

function hueOnBarAxis(hue: number, pair: QuizPair): number {
  if (pair === "blue-green") {
    const { lo, hi } = RANGE[pair];
    return Math.min(hi, Math.max(lo, hue));
  }
  let h = hue;
  if (h < 180) h += 360;
  return h;
}

/** Position along the bar in percent (0–100). */
export function hueToBarPercent(hue: number, pair: QuizPair): number {
  if (pair === "blue-green") {
    const { lo, hi } = RANGE[pair];
    return ((hue - lo) / (hi - lo)) * 100;
  }
  const axis = hueOnBarAxis(hue, pair);
  const span = 60;
  return ((axis - 350) / span) * 100;
}

export function pairGradientCss(pair: QuizPair, cal: Calibration): string {
  const steps = 32;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    let h: number;
    if (pair === "blue-green") {
      const { lo, hi } = RANGE[pair];
      h = lo + ((hi - lo) * i) / steps;
    } else {
      const t = (60 * i) / steps;
      h = 350 + t;
      if (h >= 360) h -= 360;
    }
    const pct = (100 * i) / steps;
    stops.push(`${calibratedCssColor(h, 1, 1, cal)} ${pct.toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export type PairCiBarOptions = {
  boundsLo?: number;
  boundsHi?: number;
  pastHues?: number[];
  muted?: boolean;
  /** Reserve bracket and dot rows even when empty (home cards). */
  fixedLayout?: boolean;
};

function appendBracketRow(
  bracket: HTMLElement,
  pair: QuizPair,
  boundsLo: number,
  boundsHi: number,
) {
  bracket.setAttribute(
    "aria-label",
    `Session band ${boundsLo.toFixed(1)}° to ${boundsHi.toFixed(1)}°`,
  );

  const loPct = hueToBarPercent(boundsLo, pair);
  const hiPct = hueToBarPercent(boundsHi, pair);
  const spanPct = Math.abs(hiPct - loPct);

  if (spanPct < 14) {
    const cluster = document.createElement("span");
    cluster.className = "ci-mark-cluster";
    cluster.style.left = `${(loPct + hiPct) / 2}%`;

    const loLabel = document.createElement("span");
    loLabel.className = "ci-bound-label";
    loLabel.textContent = `${boundsLo.toFixed(1)}°`;

    const open = document.createElement("span");
    open.className = "ci-bracket-paren inline";
    open.textContent = "(";

    const close = document.createElement("span");
    close.className = "ci-bracket-paren inline";
    close.textContent = ")";

    const hiLabel = document.createElement("span");
    hiLabel.className = "ci-bound-label";
    hiLabel.textContent = `${boundsHi.toFixed(1)}°`;

    cluster.append(loLabel, open, hiLabel, close);
    bracket.append(cluster);
    return;
  }

  const loMark = document.createElement("span");
  loMark.className = "ci-mark lo";
  loMark.style.left = `${loPct}%`;

  const loLabel = document.createElement("span");
  loLabel.className = "ci-bound-label";
  loLabel.textContent = `${boundsLo.toFixed(1)}°`;

  const open = document.createElement("span");
  open.className = "ci-bracket-paren inline";
  open.textContent = "(";

  loMark.append(loLabel, open);

  const hiMark = document.createElement("span");
  hiMark.className = "ci-mark hi";
  hiMark.style.left = `${hiPct}%`;

  const close = document.createElement("span");
  close.className = "ci-bracket-paren inline";
  close.textContent = ")";

  const hiLabel = document.createElement("span");
  hiLabel.className = "ci-bound-label";
  hiLabel.textContent = `${boundsHi.toFixed(1)}°`;

  hiMark.append(close, hiLabel);
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

  const pastHues = options.pastHues ?? [];
  const hasSession = options.boundsLo != null && options.boundsHi != null;
  const showBracket = hasSession || options.fixedLayout;

  if (showBracket) {
    const bracket = document.createElement("div");
    bracket.className = "ci-bracket";
    if (hasSession) {
      appendBracketRow(bracket, pair, options.boundsLo!, options.boundsHi!);
    }
    wrap.append(bracket);
  }

  const bar = document.createElement("div");
  bar.className = "ci-gradient-bar";
  bar.style.background = pairGradientCss(pair, cal);
  wrap.append(bar);

  const showDots = pastHues.length > 0 || options.fixedLayout;
  if (showDots) {
    const dots = document.createElement("div");
    dots.className = "ci-dots";
    for (const h of pastHues) {
      const dot = document.createElement("span");
      dot.className = "ci-dot";
      dot.style.left = `${hueToBarPercent(h, pair)}%`;
      dot.title = `${h.toFixed(1)}°`;
      dots.append(dot);
    }
    wrap.append(dots);
  }

  return wrap;
}
