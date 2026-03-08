import { GameOfLife } from './GameOfLife.ts';
import { Renderer } from './Renderer.ts';
import { tryUpdateHighScore, loadRecord } from './StorageEngine.ts';
import { Renderer3D } from './Renderer3D.ts';
import type { CellChange3D, Rules3D } from './GameOfLife3D.ts';
import Worker3DClass from './worker3d.ts?worker';

// ── Constants ────────────────────────────────────────────────────────────────
const CELL_SIZE = 12;
const CANVAS_W  = 800;
const CANVAS_H  = 600;
const COLS = Math.floor(CANVAS_W / CELL_SIZE); // 66
const ROWS = Math.floor(CANVAS_H / CELL_SIZE); // 50

// 3D grid dimensions (50×50×30 = 75,000 cells — Web Worker is mandatory)
const COLS3D   = 50;
const ROWS3D   = 50;
const LAYERS3D = 30;

const RULE_PRESETS: Record<string, Rules3D> = {
  'B6/S567': { born: [6],    survive: [5, 6, 7] },
  'B5/S45':  { born: [5],    survive: [4, 5]    },
  'B5/S56':  { born: [5],    survive: [5, 6]    },
  'B4/S35':  { born: [4],    survive: [3, 5]    },
  'B6/S56':  { born: [6],    survive: [5, 6]    },
};

// ── DOM ──────────────────────────────────────────────────────────────────────
const canvas         = document.getElementById('gameCanvas')    as HTMLCanvasElement;
const playPauseBtn   = document.getElementById('playPauseBtn')  as HTMLButtonElement;
const randomizeBtn   = document.getElementById('randomizeBtn')  as HTMLButtonElement;
const clearBtn       = document.getElementById('clearBtn')      as HTMLButtonElement;
const speedSlider    = document.getElementById('speedSlider')   as HTMLInputElement;
const speedVal       = document.getElementById('speedVal')      as HTMLSpanElement;
const genCounter     = document.getElementById('genCounter')    as HTMLSpanElement;
const gliderBtn      = document.getElementById('gliderBtn')     as HTMLButtonElement;
const pulsarBtn      = document.getElementById('pulsarBtn')     as HTMLButtonElement;
const gosperBtn      = document.getElementById('gosperBtn')     as HTMLButtonElement;
const hofBtn         = document.getElementById('hofBtn')        as HTMLButtonElement;
const hofModal       = document.getElementById('hofModal')      as HTMLElement;
const hofScore       = document.getElementById('hofScore')      as HTMLSpanElement;
const hofDate        = document.getElementById('hofDate')       as HTMLSpanElement;
const hofEmpty       = document.getElementById('hofEmpty')      as HTMLElement;
const hofLoadBtn     = document.getElementById('hofLoadBtn')    as HTMLButtonElement;
const hofCloseBtn    = document.getElementById('hofCloseBtn')   as HTMLButtonElement;
const mode3dBtn      = document.getElementById('mode3dBtn')     as HTMLButtonElement;
const canvas3d       = document.getElementById('canvas3d')      as HTMLCanvasElement;
const rules3dWrap    = document.getElementById('rules3dWrap')   as HTMLElement;
const rules3dSelect  = document.getElementById('rules3dSelect') as HTMLSelectElement;
const a11yAnnounce   = document.getElementById('a11y-announce') as HTMLElement;

// ── State ────────────────────────────────────────────────────────────────────
const game     = new GameOfLife(COLS, ROWS);
const renderer = new Renderer(canvas, COLS, ROWS);

let running      = false;
let speed        = 10;   // steps per second
let lastStepTime = 0;
let isDrawing    = false;
let drawMode     = true; // true = paint, false = erase
let dirty        = true; // true = canvas needs a repaint

// ── Hall of Fame session tracking ────────────────────────────────────────────
// Captured on the first step of each run so it reflects manual draws too.
let sessionStartGrid     = new Uint8Array(COLS * ROWS);
let sessionStartCaptured = false;

// ── 3D mode state ─────────────────────────────────────────────────────────────
let mode:          '2d' | '3d' = '2d';
let renderer3d:    Renderer3D | null = null;
let worker3d:      Worker | null = null;
let buffer3d       = new Uint8Array(COLS3D * ROWS3D * LAYERS3D);
let generation3d   = 0;
let running3d      = false;
let lastStepTime3d = 0;
let stepPending    = false;
let workerReady    = false;
let currentRules3d: Rules3D = RULE_PRESETS['B6/S567']!;

// ── Accessibility: screen reader announcements ────────────────────────────────
// Clears then re-sets text so screen readers always pick up the new message,
// even when the previous message was identical.
function announce(message: string): void {
  a11yAnnounce.textContent = '';
  requestAnimationFrame(() => {
    a11yAnnounce.textContent = message;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function updateGenCounter(): void {
  const gen = mode === '3d' ? generation3d : game.generation;
  genCounter.textContent = gen.toString().padStart(6, '0');
}

function setRunning(state: boolean): void {
  if (mode === '3d') {
    running3d = state;
  } else {
    running = state;
    canvas.setAttribute('aria-label', `Game board — simulation is ${state ? 'running' : 'paused'}`);
  }
  playPauseBtn.textContent = state ? '⏸ PAUSE' : '▶ PLAY';
  playPauseBtn.classList.toggle('active', state);
  playPauseBtn.setAttribute('aria-pressed', String(state));
  announce(state ? 'Game started' : 'Game paused');
}

function doRandomize(): void {
  if (mode === '3d') {
    if (worker3d && workerReady) worker3d.postMessage({ type: 'randomize', density: 0.2 });
    return;
  }
  const newRecord = tryUpdateHighScore(game.generation, sessionStartGrid);
  game.randomize();
  sessionStartCaptured = false;
  renderer.syncVisualState(game.getBuffer());
  dirty = true;
  updateGenCounter();
  announce(newRecord ? 'New high score! Board randomized' : 'Board randomized');
}

function doClear(): void {
  if (mode === '3d') {
    if (worker3d && workerReady) worker3d.postMessage({ type: 'clear' });
    return;
  }
  const newRecord = tryUpdateHighScore(game.generation, sessionStartGrid);
  game.clear();
  sessionStartCaptured = false;
  renderer.syncVisualState(game.getBuffer());
  dirty = true;
  updateGenCounter();
  announce(newRecord ? 'New high score! Board cleared' : 'Board cleared');
}

// ── Hall of Fame UI ───────────────────────────────────────────────────────────
function openHof(): void {
  const record = loadRecord();
  if (record) {
    hofScore.textContent = record.highScore.toString().padStart(6, '0');
    hofDate.textContent  = new Date(record.timestamp).toLocaleDateString();
    hofLoadBtn.hidden    = false;
    hofEmpty.hidden      = true;
  } else {
    hofScore.textContent = '------';
    hofDate.textContent  = '------';
    hofLoadBtn.hidden    = true;
    hofEmpty.hidden      = false;
  }
  hofModal.hidden = false;
  hofCloseBtn.focus();
  announce('Hall of Fame opened');
}

function closeHof(): void {
  hofModal.hidden = true;
  hofBtn.focus();
}

// ── 3D mode ───────────────────────────────────────────────────────────────────
function onWorkerMessage(e: MessageEvent): void {
  const msg = e.data as { type: string; generation: number; buffer: ArrayBuffer; changes?: CellChange3D[] };
  if (msg.type !== 'ready' && msg.type !== 'sync') return;

  buffer3d     = new Uint8Array(msg.buffer);
  generation3d = msg.generation;

  // Step replies include a changes diff — use O(changedCells) differential update.
  // Init/randomize/clear replies have no changes — full rebuild.
  if (msg.type === 'sync' && msg.changes !== undefined) {
    renderer3d!.applyChanges(msg.changes);
  } else {
    renderer3d!.syncFromBuffer(buffer3d);
  }

  updateGenCounter();
  stepPending = false;
  if (msg.type === 'ready') {
    workerReady = true;
    announce('3D engine ready');
  }
}

function initWorker3D(): void {
  const w = new Worker3DClass();
  w.onmessage = onWorkerMessage;
  w.postMessage({ type: 'init', cols: COLS3D, rows: ROWS3D, layers: LAYERS3D, rules: currentRules3d });
  worker3d = w;
}

function enterMode3D(): void {
  mode = '3d';
  canvas.hidden       = true;
  canvas3d.hidden     = false;
  rules3dWrap.hidden  = false;
  mode3dBtn.textContent = '2D MODE';
  mode3dBtn.setAttribute('aria-label', 'Switch to 2D mode');

  if (!renderer3d) {
    renderer3d = new Renderer3D(canvas3d, COLS3D, ROWS3D, LAYERS3D);
    initWorker3D();
  }

  setRunning(false);
  updateGenCounter();
  announce('3D mode activated — drag to orbit, scroll to zoom');
}

function enterMode2D(): void {
  mode = '2d';
  canvas.hidden       = false;
  canvas3d.hidden     = true;
  rules3dWrap.hidden  = true;
  mode3dBtn.textContent = '3D MODE';
  mode3dBtn.setAttribute('aria-label', 'Switch to 3D mode');

  dirty = true; // ensure first 2D frame is always drawn
  updateGenCounter();
  announce('2D mode activated');
}

// ── Game loop ────────────────────────────────────────────────────────────────
function gameLoop(timestamp: number): void {
  if (mode === '2d') {
    // ── 2D path ──────────────────────────────────────────────────────────────
    if (running) {
      const interval = 1000 / Math.min(speed, 60);
      if (timestamp - lastStepTime >= interval) {
        const stepsToRun = Math.floor((timestamp - lastStepTime) / (1000 / speed));
        for (let i = 0; i < stepsToRun; i++) {
          if (!sessionStartCaptured) {
            sessionStartGrid     = game.getBuffer().slice();
            sessionStartCaptured = true;
          }
          const changes = game.step();
          renderer.applyChanges(changes);
        }
        lastStepTime += stepsToRun * (1000 / speed);
        updateGenCounter();
        dirty = true;
      }
    }
    // Skip render when paused, stable, and nothing has changed.
    if (dirty || renderer.hasPendingTransitions) {
      renderer.render(game.getBuffer());
      dirty = false;
    }
  } else {
    // ── 3D path ──────────────────────────────────────────────────────────────
    if (running3d && !stepPending && workerReady) {
      const interval = 1000 / Math.min(speed, 60);
      if (timestamp - lastStepTime3d >= interval) {
        stepPending    = true;
        lastStepTime3d = timestamp;
        worker3d!.postMessage({ type: 'step' });
      }
    }
    renderer3d?.render();
  }

  requestAnimationFrame(gameLoop);
}

// ── Button controls ───────────────────────────────────────────────────────────
playPauseBtn.addEventListener('click', () => setRunning(mode === '3d' ? !running3d : !running));
randomizeBtn.addEventListener('click', doRandomize);
clearBtn.addEventListener('click', doClear);

speedSlider.addEventListener('input', () => {
  speed = parseInt(speedSlider.value, 10);
  speedVal.textContent = speed.toString();
});

gliderBtn.addEventListener('click', () => {
  const cx = Math.floor(COLS / 2) - 1;
  const cy = Math.floor(ROWS / 2) - 1;
  game.placeGlider(cx, cy);
  dirty = true;
  announce('Glider pattern placed at centre');
});

pulsarBtn.addEventListener('click', () => {
  game.placePulsar(Math.floor(COLS / 2) - 6, Math.floor(ROWS / 2) - 6);
  dirty = true;
  announce('Pulsar pattern placed at centre');
});

gosperBtn.addEventListener('click', () => {
  game.placeGosperGliderGun(2, Math.floor(ROWS / 2) - 4);
  dirty = true;
  announce('Gosper Glider Gun placed');
});

mode3dBtn.addEventListener('click', () => {
  if (mode === '2d') enterMode3D(); else enterMode2D();
});

rules3dSelect.addEventListener('change', () => {
  const preset = RULE_PRESETS[rules3dSelect.value];
  if (!preset || !worker3d) return;
  currentRules3d = preset;
  worker3d.postMessage({ type: 'setRules', rules: preset });
  announce(`Rules changed to ${rules3dSelect.value}`);
});

hofBtn.addEventListener('click', openHof);
hofCloseBtn.addEventListener('click', closeHof);

hofLoadBtn.addEventListener('click', () => {
  const record = loadRecord();
  if (!record) return;
  if (mode === '3d') enterMode2D();
  setRunning(false);
  game.clear();
  for (const i of record.startGrid) {
    game.setCell(i % COLS, Math.floor(i / COLS), true);
  }
  sessionStartGrid     = game.getBuffer().slice();
  sessionStartCaptured = true;
  renderer.syncVisualState(game.getBuffer());
  dirty = true;
  updateGenCounter();
  closeHof();
  announce('Hall of Fame starting grid loaded');
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
// Guard: let the browser handle keys natively when focus is on an interactive
// element (button or input). This prevents our global Space handler from
// swallowing button activation (WCAG 2.1.1).
function isInteractiveTarget(e: KeyboardEvent): boolean {
  return e.target instanceof HTMLButtonElement ||
         e.target instanceof HTMLInputElement;
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Escape' && !hofModal.hidden) {
    closeHof();
    return;
  }
  switch (e.code) {
    case 'Space':
      if (isInteractiveTarget(e)) return; // let button/slider handle it
      e.preventDefault();
      setRunning(mode === '3d' ? !running3d : !running);
      break;
    case 'KeyR':
      if (isInteractiveTarget(e)) return;
      doRandomize();
      break;
    case 'KeyC':
      if (isInteractiveTarget(e)) return;
      doClear();
      break;
  }
});

// ── Mouse drawing ─────────────────────────────────────────────────────────────
function getCellCoords(e: MouseEvent): { cx: number; cy: number } {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    cx: Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE),
    cy: Math.floor((e.clientY - rect.top)  * scaleY / CELL_SIZE),
  };
}

function paintCell(cx: number, cy: number): void {
  if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return;
  game.setCell(cx, cy, drawMode);
  renderer.setVisualState(cy * COLS + cx, drawMode ? 1.0 : 0.0);
  dirty = true;
}

canvas.addEventListener('mousedown', (e: MouseEvent) => {
  e.preventDefault();
  canvas.focus(); // e.preventDefault() suppresses default focus — restore it manually
  isDrawing = true;
  drawMode  = e.button !== 2;
  const { cx, cy } = getCellCoords(e);
  paintCell(cx, cy);
});

canvas.addEventListener('mousemove', (e: MouseEvent) => {
  if (!isDrawing) return;
  const { cx, cy } = getCellCoords(e);
  paintCell(cx, cy);
});

window.addEventListener('mouseup', () => { isDrawing = false; });
canvas.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

// ── Boot ─────────────────────────────────────────────────────────────────────
updateGenCounter();
requestAnimationFrame(gameLoop);
