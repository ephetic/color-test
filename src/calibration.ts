const STORAGE_KEY = "color-test-calibration-v1";
const CALIBRATED_FLAG_KEY = "color-test-calibrated-v1";

export type Calibration = {
  brightness: number;
  contrast: number;
  gamma: number;
};

export const DEFAULT_CALIBRATION: Calibration = {
  brightness: 0,
  contrast: 1,
  gamma: 1,
};

export function loadCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CALIBRATION };
    const parsed = JSON.parse(raw) as Partial<Calibration>;
    return {
      brightness: clamp(parsed.brightness ?? 0, -0.35, 0.35),
      contrast: clamp(parsed.contrast ?? 1, 0.5, 2),
      gamma: clamp(parsed.gamma ?? 1, 0.45, 3),
    };
  } catch {
    return { ...DEFAULT_CALIBRATION };
  }
}

export function saveCalibration(cal: Calibration): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
}

export function markCalibrated(): void {
  localStorage.setItem(CALIBRATED_FLAG_KEY, "1");
}

export function hasCalibrated(): boolean {
  return localStorage.getItem(CALIBRATED_FLAG_KEY) === "1";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Apply display compensation in linear 0–1 RGB (brightness → contrast → gamma). */
export function applyCalibration(
  r: number,
  g: number,
  b: number,
  cal: Calibration,
): [number, number, number] {
  const adjust = (c: number) => {
    let x = Math.min(1, Math.max(0, c + cal.brightness));
    x = Math.min(1, Math.max(0, (x - 0.5) * cal.contrast + 0.5));
    return Math.pow(x, 1 / cal.gamma);
  };
  return [adjust(r), adjust(g), adjust(b)];
}

/** Wizard previews: vary one control while the others stay neutral. */
export function calForStep(
  cal: Calibration,
  step: "brightness" | "contrast" | "gamma",
): Calibration {
  switch (step) {
    case "brightness":
      return { ...DEFAULT_CALIBRATION, brightness: cal.brightness };
    case "contrast":
      return { ...DEFAULT_CALIBRATION, contrast: cal.contrast };
    case "gamma":
      return { ...DEFAULT_CALIBRATION, gamma: cal.gamma };
  }
}
