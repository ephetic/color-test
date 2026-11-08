import {
  clearCalibration,
  DEFAULT_CALIBRATION,
  hasCalibrated,
  loadCalibration,
  type Calibration,
} from "./calibration";
import {
  renderCalibrationWizard,
  type WizardMode,
} from "./calibration-wizard";
import { calibratedCssColor } from "./color";
import {
  chooseLeft,
  chooseRight,
  currentHue,
  isDone,
  labelsFor,
  loadResults,
  resultBounds,
  resultHue,
  resultsForPair,
  saveResult,
  startBisection,
  clearResults,
  type BisectionState,
  type QuizPair,
  pairHueRange,
  type QuizResult,
} from "./quiz";
import { buildPairCiBar } from "./result-visual";
import { aggregateCi95, displayBand, formatBounds } from "./stats";

type Screen =
  | "home"
  | "calibration-menu"
  | "calibrate"
  | "quiz"
  | "result"
  | "history";

const app = document.getElementById("app");
if (!app) throw new Error("#app missing");

let screen: Screen = "home";
let cal: Calibration = loadCalibration();
let quiz: BisectionState | null = null;
let lastSaved: QuizResult | null = null;
let teardown: (() => void) | null = null;
let calibrateMode: WizardMode = "all";

function clearStoredData(): void {
  clearResults();
  clearCalibration();
  cal = { ...DEFAULT_CALIBRATION };
  lastSaved = null;
}

function openCalibrationMenu() {
  screen = "calibration-menu";
  render();
}

function openCalibrationStep(mode: Exclude<WizardMode, "all">) {
  calibrateMode = mode;
  screen = "calibrate";
  render();
}

function render() {
  teardown?.();
  teardown = null;
  app!.innerHTML = "";
  app!.className = "";
  app!.style.backgroundColor = "";

  switch (screen) {
    case "home":
      renderHome();
      break;
    case "calibration-menu":
      renderCalibrationMenu();
      break;
    case "calibrate":
      teardown = renderCalibrationWizard(
        app!,
        {
          onComplete: (c) => {
            cal = c;
            screen = "calibration-menu";
            render();
          },
          onSkip: () => {
            screen = "calibration-menu";
            render();
          },
        },
        { mode: calibrateMode },
      );
      break;
    case "quiz":
      renderQuiz();
      break;
    case "result":
      renderResult();
      break;
    case "history":
      renderHistory();
      break;
  }
}

function pairLabel(pair: QuizPair): string {
  return pair === "blue-green" ? "Blue / green" : "Red / orange";
}

function renderHome() {
  app!.className = "screen home";

  const gearWrap = document.createElement("div");
  gearWrap.className = "home-gear-wrap";

  const calBtn = document.createElement("button");
  calBtn.type = "button";
  calBtn.className = "home-icon-btn home-gear";
  calBtn.dataset.action = "calibration";
  calBtn.setAttribute("aria-label", "Settings");
  calBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.12.84a8 8 0 0 0-1.63.94l-.81-.31a2 2 0 0 0-2.42.9l-.22.38a2 2 0 0 0 .51 2.47l.63.58a8.05 8.05 0 0 0 0 2.66l-.63.58a2 2 0 0 0-.51 2.47l.22.38a2 2 0 0 0 2.42.9l.81-.31c.51.38 1.05.7 1.63.94l.12.84a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.12-.84a8 8 0 0 0 1.63-.94l.81.31a2 2 0 0 0 2.42-.9l.22-.38a2 2 0 0 0-.51-2.47l-.63-.58a8.05 8.05 0 0 0 0-2.66l.63-.58a2 2 0 0 0 .51-2.47l-.22-.38a2 2 0 0 0-2.42-.9l-.81.31a8 8 0 0 0-1.63-.94l-.12-.84A2 2 0 0 0 12.22 2z"/><circle cx="12" cy="12" r="3"/></svg>`;

  if (!hasCalibrated()) {
    const nudge = document.createElement("p");
    nudge.className = "home-cal-nudge";
    nudge.setAttribute("role", "status");
    nudge.id = "home-cal-nudge";
    nudge.textContent = "Calibrate display for reliable hues";
    calBtn.setAttribute("aria-describedby", "home-cal-nudge");
    gearWrap.append(nudge, calBtn);
  } else {
    gearWrap.append(calBtn);
  }

  const panel = document.createElement("div");
  panel.className = "home-panel";

  const actions = document.createElement("div");
  actions.className = "home-actions column";

  const pairs: QuizPair[] = ["blue-green", "red-orange"];
  for (const pair of pairs) {
    const results = resultsForPair(pair);
    const latest = results.at(-1);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "home-pair-card";
    card.dataset.pair = pair;
    card.setAttribute("aria-label", `Start ${pairLabel(pair)} test`);

    const arc = pairHueRange(pair);
    const barOpts = {
      fixedLayout: true,
      muted: true,
      ...(latest != null
        ? (() => {
            const hues = results.map((r) => r.hueDegrees);
            const band = displayBand(hues, pair);
            return {
              boundsLo: band.lo,
              boundsHi: band.hi,
              pastHues: hues,
              latestHue: latest.hueDegrees,
            };
          })()
        : {
            boundsLo: arc.lo,
            boundsHi: arc.hi,
          }),
    };

    card.append(buildPairCiBar(pair, cal, barOpts));
    actions.append(card);
  }

  panel.append(actions);

  const startToast = document.createElement("p");
  startToast.className = "home-start-toast";
  startToast.setAttribute("role", "status");
  startToast.textContent = "Tap gradient to start";

  app!.append(gearWrap, panel, startToast);

  calBtn.addEventListener("click", () => openCalibrationMenu());

  const hintTimer = window.setTimeout(() => {
    startToast.classList.add("visible");
  }, 30_000);
  teardown = () => clearTimeout(hintTimer);

  actions.querySelectorAll<HTMLButtonElement>("[data-pair]").forEach((btn) => {
    btn.addEventListener("click", () => {
      startToast.classList.remove("visible");
      quiz = startBisection(btn.dataset.pair as QuizPair);
      screen = "quiz";
      render();
    });
  });
}

function renderCalibrationMenu() {
  app!.className = "screen home";
  const results = loadResults();
  const calNote = hasCalibrated()
    ? `Saved: brightness ${cal.brightness.toFixed(2)}, contrast ${cal.contrast.toFixed(2)}, gamma ${cal.gamma.toFixed(2)}`
    : "No values saved yet for this browser.";

  app!.innerHTML = `
    <div class="home-panel">
      <h1>Settings</h1>
      <p class="meta">${calNote}</p>
      <div class="home-actions column">
        <button type="button" class="btn primary" data-action="cal-brightness">Brightness</button>
        <button type="button" class="btn primary" data-action="cal-contrast">Contrast</button>
        <button type="button" class="btn primary" data-action="cal-gamma">Gamma</button>
        <button type="button" class="btn danger" data-action="clear-data"${
          results.length || hasCalibrated() ? "" : " disabled"
        }>Clear data</button>
        <button type="button" class="btn" data-action="back">Back</button>
      </div>
    </div>
  `;

  app!
    .querySelector("[data-action=cal-brightness]")
    ?.addEventListener("click", () => openCalibrationStep("brightness"));
  app!
    .querySelector("[data-action=cal-contrast]")
    ?.addEventListener("click", () => openCalibrationStep("contrast"));
  app!
    .querySelector("[data-action=cal-gamma]")
    ?.addEventListener("click", () => openCalibrationStep("gamma"));
  app!.querySelector("[data-action=back]")?.addEventListener("click", () => {
    screen = "home";
    render();
  });
  app!.querySelector("[data-action=clear-data]")?.addEventListener("click", () => {
    if (confirm("Delete all quiz scores and calibration for this browser?")) {
      clearStoredData();
      render();
    }
  });
}

function renderQuiz() {
  if (!quiz) return;

  const hue = currentHue(quiz);
  const labels = labelsFor(quiz.pair);

  app!.className = "screen quiz";
  app!.style.backgroundColor = calibratedCssColor(hue, 1, 1, cal);

  const bar = document.createElement("div");
  bar.className = "quiz-bar";
  bar.innerHTML = `
    <button type="button" class="quiz-btn" data-side="left">${labels.left}</button>
    <button type="button" class="quiz-btn reset" data-side="reset">Reset</button>
    <button type="button" class="quiz-btn" data-side="right">${labels.right}</button>
  `;

  app!.append(bar);

  bar.querySelector("[data-side=left]")?.addEventListener("click", () => advance(chooseLeft));
  bar.querySelector("[data-side=right]")?.addEventListener("click", () => advance(chooseRight));
  bar.querySelector("[data-side=reset]")?.addEventListener("click", () => {
    if (quiz) quiz = startBisection(quiz.pair);
    render();
  });

  function advance(mutate: (s: BisectionState) => BisectionState) {
    if (!quiz) return;
    quiz = mutate(quiz);
    if (isDone(quiz)) {
      const bounds = resultBounds(quiz);
      lastSaved = {
        id: crypto.randomUUID(),
        pair: quiz.pair,
        hueDegrees: resultHue(quiz),
        boundsLo: bounds.lo,
        boundsHi: bounds.hi,
        steps: quiz.step,
        calibrated: hasCalibrated(),
        calibration: { ...cal },
        at: new Date().toISOString(),
      };
      saveResult(lastSaved);
      screen = "result";
    }
    render();
  }
}

function sessionCiText(r: QuizResult): string {
  return `95% session band (bisection bracket): ${formatBounds(r.boundsLo, r.boundsHi, r.pair)}`;
}

function renderResult() {
  const r = lastSaved ?? loadResults().at(-1) ?? null;

  if (!r) {
    screen = "home";
    render();
    return;
  }

  const pastHues = resultsForPair(r.pair).map((x) => x.hueDegrees);

  app!.className = "screen result";
  app!.style.backgroundColor = calibratedCssColor(r.hueDegrees, 1, 1, cal);

  const overlay = document.createElement("div");
  overlay.className = "result-card wide";

  const homeBtn = document.createElement("button");
  homeBtn.type = "button";
  homeBtn.className = "result-icon-btn result-home";
  homeBtn.dataset.action = "home";
  homeBtn.setAttribute("aria-label", "Home");
  homeBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>`;

  const pairTitle = document.createElement("p");
  pairTitle.className = "result-pair-title";
  pairTitle.textContent = pairLabel(r.pair);

  const readout = document.createElement("p");
  readout.className = "hue-readout";
  readout.textContent = `${r.hueDegrees.toFixed(1)}°`;

  const band = displayBand(pastHues, r.pair);
  const ciBar = buildPairCiBar(r.pair, cal, {
    boundsLo: band.lo,
    boundsHi: band.hi,
    pastHues,
    latestHue: r.hueDegrees,
  });

  const againBtn = document.createElement("button");
  againBtn.type = "button";
  againBtn.className = "result-icon-btn result-again primary";
  againBtn.dataset.action = "again";
  againBtn.setAttribute("aria-label", `Run ${pairLabel(r.pair)} again`);
  againBtn.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>`;

  overlay.append(homeBtn, pairTitle, readout, ciBar, againBtn);

  homeBtn.addEventListener("click", () => {
    quiz = null;
    lastSaved = null;
    screen = "home";
    render();
  });

  againBtn.addEventListener("click", () => {
    quiz = startBisection(r.pair);
    lastSaved = null;
    screen = "quiz";
    render();
  });

  app!.append(overlay);
}

function renderHistory() {
  app!.className = "screen home";
  const all = [...loadResults()].reverse();
  const pairs: QuizPair[] = ["blue-green", "red-orange"];

  const summaries = pairs
    .map((pair) => {
      const hues = resultsForPair(pair).map((r) => r.hueDegrees);
      const agg = aggregateCi95(hues, pair);
      if (!agg) return "";
      const ci =
        agg.n > 1
          ? `${agg.mean.toFixed(1)}° (95% CI ${agg.low.toFixed(1)}° – ${agg.high.toFixed(1)}°, n=${agg.n})`
          : `${agg.mean.toFixed(1)}° (n=1 — need more runs for CI)`;
      return `<div class="summary-row"><span>${pairLabel(pair)}</span><span class="summary-val">${ci}</span></div>`;
    })
    .join("");

  const list =
    all.length === 0
      ? `<p class="wizard-copy">No saved scores yet.</p>`
      : `<ul class="results-list">
          ${all
            .map(
              (r) => `
            <li class="results-item">
              <div class="results-row">
                <span class="results-pair">${pairLabel(r.pair)}</span>
                <span class="results-hue">${r.hueDegrees.toFixed(1)}°</span>
              </div>
              <div class="results-meta">${sessionCiText(r)} · ${r.steps} steps${
                r.calibrated ? "" : " · uncalibrated"
              }<br/>
              <time datetime="${r.at}">${new Date(r.at).toLocaleString()}</time></div>
            </li>`,
            )
            .join("")}
        </ul>`;

  app!.innerHTML = `
    <div class="home-panel history-panel">
      <h1>Past results</h1>
      <p class="wizard-copy">All quiz scores are stored in this browser. Calibration values are saved separately and snapshotted on each run.</p>
      ${summaries ? `<h2 class="subhead">Summary</h2>${summaries}` : ""}
      ${list}
      <div class="wizard-actions">
        <button type="button" class="btn" data-action="calibration">Calibration</button>
        <button type="button" class="btn" data-action="home">Home</button>
        <button type="button" class="btn danger" data-action="clear"${
          all.length || hasCalibrated() ? "" : " disabled"
        }>Clear data</button>
      </div>
    </div>
  `;

  app!.querySelector("[data-action=home]")?.addEventListener("click", () => {
    screen = "home";
    render();
  });
  app!
    .querySelector("[data-action=calibration]")
    ?.addEventListener("click", () => openCalibrationMenu());
  app!.querySelector("[data-action=clear]")?.addEventListener("click", () => {
    if (confirm("Delete all quiz scores and calibration for this browser?")) {
      clearStoredData();
      screen = "history";
      render();
    }
  });
}

render();
