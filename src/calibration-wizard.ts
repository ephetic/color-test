import {
  DEFAULT_CALIBRATION,
  calForStep,
  loadCalibration,
  markCalibrated,
  saveCalibration,
  type Calibration,
} from "./calibration";
import { calibratedCssColor } from "./color";

export type WizardStep = "intro" | "brightness" | "contrast" | "gamma" | "done";

export type WizardCallbacks = {
  onComplete: (cal: Calibration) => void;
  onSkip: () => void;
};

export type WizardMode = "all" | "brightness" | "contrast" | "gamma";

export type WizardOptions = {
  mode?: WizardMode;
};

function initialStep(mode: WizardMode): WizardStep {
  if (mode === "all") return "intro";
  return mode;
}

export function renderCalibrationWizard(
  root: HTMLElement,
  callbacks: WizardCallbacks,
  options: WizardOptions = {},
): () => void {
  const mode = options.mode ?? "all";
  let step: WizardStep = initialStep(mode);
  let cal: Calibration = { ...loadCalibration() };
  let contrastLo = 0.5;
  let contrastHi = 2;
  let contrastPickRound = 1;

  const finish = () => {
    saveCalibration(cal);
    markCalibrated();
    callbacks.onComplete(cal);
  };

  const mount = () => {
    root.innerHTML = "";
    root.className = "screen wizard";

    if (step === "intro") {
      root.append(
        panel(
          "Display calibration",
          "",
          [
            button("Start calibration", () => {
              step = "brightness";
              mount();
            }),
            buttonSecondary("Skip (use defaults)", () => callbacks.onSkip()),
          ],
        ),
      );
      return;
    }

    if (step === "brightness") {
      const preview = document.createElement("div");
      preview.className = "cal-pattern brightness-pattern";
      updateBrightnessPattern(preview, cal);

      root.append(
        patternStep(
          "Brightness",
          "Slide until the first narrow strip is just barely lighter than the wide black bar beside it—judge only the bars in this box, not the gray page around it. On the right, keep the last narrow strip slightly darker than the wide white bar (not clipped to the same white).",
          preview,
          slider("Brightness", cal.brightness, -0.35, 0.35, 0.01, (v) => {
            cal = { ...cal, brightness: v };
            saveCalibration(cal);
            updateBrightnessPattern(preview, cal);
          }),
          [
            button(mode === "brightness" ? "Save" : "Next", () => {
              if (mode === "brightness") {
                finish();
                return;
              }
              contrastLo = 0.5;
              contrastHi = 2;
              contrastPickRound = 1;
              step = "contrast";
              mount();
            }),
            buttonSecondary("Reset step", () => {
              cal = { ...cal, brightness: DEFAULT_CALIBRATION.brightness };
              saveCalibration(cal);
              mount();
            }),
            ...(mode === "brightness"
              ? [buttonSecondary("Cancel", () => callbacks.onSkip())]
              : []),
          ],
        ),
      );
      return;
    }

    if (step === "contrast") {
      const choices = contrastTriple(contrastLo, contrastHi);
      const copy =
        contrastPickRound === 1
          ? "Which ramp has the most evenly spaced steps between the fixed dark and light ends?"
          : "Same question—pick the most even steps.";

      root.append(
        contrastPickStep(
          "Contrast",
          copy,
          choices,
          (index) => {
            const picked = choices[index];
            if (contrastPickRound === 1) {
              const m1 = choices[0];
              const mid = choices[1];
              const m2 = choices[2];
              if (index === 0) contrastHi = mid;
              else if (index === 1) {
                contrastLo = m1;
                contrastHi = m2;
              } else contrastLo = mid;
              contrastPickRound = 2;
              mount();
              return;
            }
            cal = { ...cal, contrast: picked };
            saveCalibration(cal);
            if (mode === "contrast") {
              finish();
              return;
            }
            step = "gamma";
            mount();
          },
          [
            buttonSecondary("Back", () => {
                if (contrastPickRound === 2) {
                  contrastLo = 0.5;
                  contrastHi = 2;
                  contrastPickRound = 1;
                  mount();
                  return;
                }
                if (mode === "contrast") {
                  callbacks.onSkip();
                  return;
                }
                step = "brightness";
                mount();
              },
            ),
          ],
        ),
      );
      return;
    }

    if (step === "gamma") {
      const canvas = document.createElement("canvas");
      canvas.className = "cal-pattern gamma-canvas";
      const draw = () => drawGammaCanvas(canvas, calForStep(cal, "gamma"));

      root.append(
        patternStep(
          "Gamma",
          "Slide until the solid center disappears into the checkerboard around it—no visible square at the edges.",
          canvas,
          slider("Gamma", cal.gamma, 0.45, 3, 0.02, (v) => {
            cal = { ...cal, gamma: v };
            saveCalibration(cal);
            draw();
          }),
          [
            button("Save", () => {
              finish();
            }),
            buttonSecondary("Back", () => {
              if (mode === "gamma") {
                callbacks.onSkip();
                return;
              }
              contrastLo = 0.5;
              contrastHi = 2;
              contrastPickRound = 1;
              step = "contrast";
              mount();
            }),
          ],
        ),
      );
      draw();
      return;
    }
  };

  mount();
  return () => {
    root.innerHTML = "";
    root.className = "";
  };
}

function panel(title: string, body: string, actions: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.className = "wizard-panel";
  el.innerHTML = body
    ? `<h1>${title}</h1><p class="wizard-copy">${body}</p>`
    : `<h1>${title}</h1>`;
  const row = document.createElement("div");
  row.className = "wizard-actions";
  actions.forEach((a) => row.append(a));
  el.append(row);
  return el;
}

function patternStep(
  title: string,
  body: string,
  preview: HTMLElement,
  control: HTMLElement,
  actions: HTMLElement[],
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "wizard-pattern";
  wrap.innerHTML = `<h1>${title}</h1><p class="wizard-copy">${body}</p>`;
  wrap.append(preview, control);
  const row = document.createElement("div");
  row.className = "wizard-actions";
  actions.forEach((a) => row.append(a));
  wrap.append(row);
  return wrap;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn primary";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function buttonSecondary(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function slider(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (v: number) => void,
): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "slider-row";
  const title = document.createElement("span");
  title.textContent = `${label}: ${value.toFixed(2)}`;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    title.textContent = `${label}: ${v.toFixed(2)}`;
    onChange(v);
  });
  wrap.append(title, input);
  return wrap;
}

function gray(cal: Calibration, t: number): string {
  return calibratedCssColor(0, 0, t, cal);
}

function updateBrightnessPattern(el: HTMLElement, cal: Calibration) {
  const steps: { t: number; target?: boolean }[] = [
    { t: 0, target: true },
    { t: 0.02 },
    { t: 0.08 },
    { t: 0.18 },
    { t: 0.35 },
    { t: 0.55 },
    { t: 0.78 },
    { t: 0.95 },
    { t: 1, target: true },
  ];
  const stepCal = calForStep(cal, "brightness");
  el.replaceChildren(
    ...steps.map(({ t, target }) => {
      const s = document.createElement("div");
      s.className = target ? "stripe target" : "stripe";
      s.style.backgroundColor = gray(target ? DEFAULT_CALIBRATION : stepCal, t);
      return s;
    }),
  );
}

const CONTRAST_RAMP_LEVELS = [0.12, 0.31, 0.5, 0.69, 0.88];

function contrastTriple(lo: number, hi: number): [number, number, number] {
  const span = hi - lo;
  const m1 = lo + span / 3;
  const m2 = hi - span / 3;
  return [m1, (m1 + m2) / 2, m2];
}

function contrastPickStep(
  title: string,
  body: string,
  contrasts: [number, number, number],
  onPick: (index: 0 | 1 | 2) => void,
  actions: HTMLElement[],
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "wizard-pattern";
  wrap.innerHTML = `<h1>${title}</h1><p class="wizard-copy">${body}</p>`;

  const list = document.createElement("div");
  list.className = "contrast-choices";
  contrasts.forEach((c, i) => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "contrast-choice";
    const ramp = document.createElement("div");
    ramp.className = "contrast-ramp";
    fillContrastRamp(ramp, c);
    choice.append(ramp);
    choice.addEventListener("click", () => onPick(i as 0 | 1 | 2));
    list.append(choice);
  });
  wrap.append(list);

  const row = document.createElement("div");
  row.className = "wizard-actions";
  actions.forEach((a) => row.append(a));
  wrap.append(row);
  return wrap;
}

function fillContrastRamp(ramp: HTMLElement, contrast: number) {
  const trial = calForStep({ ...DEFAULT_CALIBRATION, contrast }, "contrast");
  const steps: { t: number; target?: boolean }[] = [
    { t: 0, target: true },
    ...CONTRAST_RAMP_LEVELS.map((t) => ({ t })),
    { t: 1, target: true },
  ];
  ramp.replaceChildren(
    ...steps.map(({ t, target }) => {
      const s = document.createElement("div");
      s.className = target ? "contrast-ramp-step target" : "contrast-ramp-step";
      s.style.backgroundColor = gray(target ? DEFAULT_CALIBRATION : trial, t);
      return s;
    }),
  );
}

function drawGammaCanvas(canvas: HTMLCanvasElement, cal: Calibration) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const black = gray(cal, 0);
  const white = gray(cal, 1);
  const tile = 2;
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      const on = ((x / tile) ^ (y / tile)) & 1;
      ctx.fillStyle = on ? white : black;
      ctx.fillRect(x, y, tile, tile);
    }
  }

  const pad = w * 0.22;
  ctx.fillStyle = gray(cal, 0.5);
  ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
}
