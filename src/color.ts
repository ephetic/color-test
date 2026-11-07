import { applyCalibration, type Calibration } from "./calibration";

/** HSV with h in [0, 360), s and v in [0, 1]. */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hh = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return [r + m, g + m, b + m];
}

export function calibratedCssColor(
  h: number,
  s: number,
  v: number,
  cal: Calibration,
): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  const [r2, g2, b2] = applyCalibration(r, g, b, cal);
  const to8 = (x: number) => Math.round(Math.min(255, Math.max(0, x * 255)));
  return `rgb(${to8(r2)}, ${to8(g2)}, ${to8(b2)})`;
}
