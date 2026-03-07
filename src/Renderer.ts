import type { CellChange } from './GameOfLife.ts';

const CELL_SIZE = 12;
const CELL_INNER = 10;          // drawn size (1 px gap on each side)
const ALIVE_COLOR = '#00ff88';
const BG_COLOR = '#0a0a0f';
const FLASH_VALUE = 1.8;        // birth flash start (>1 = extra bright)
const FADE_SPEED = 0.06;       // per animation frame (~60 fps → ~17 frames fade)

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cols: number;

  /** 0 = dead · (0–1] = alive/fading · (1–2] = birth flash */
  private readonly visualState: Float32Array;

  /** Cells currently in a visual transition (flash or fade) */
  private readonly activeSet = new Set<number>();

  constructor(canvas: HTMLCanvasElement, cols: number, rows: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot acquire 2D context');
    this.ctx = ctx;
    this.cols = cols;
    this.visualState = new Float32Array(cols * rows);
  }

  /** Call after every game.step() to register born/died cells. */
  applyChanges(changes: CellChange[]): void {
    for (const { index, alive } of changes) {
      if (alive) {
        this.visualState[index] = FLASH_VALUE;
      }
      // dying cells keep their current visualState and start fading in render()
      this.activeSet.add(index);
    }
  }

  /** Reset visual state to match buffer (after randomize / clear). */
  syncVisualState(buffer: Uint8Array): void {
    for (let i = 0; i < buffer.length; i++) {
      this.visualState[i] = buffer[i] === 1 ? 1.0 : 0.0;
    }
    this.activeSet.clear();
  }

  /** Set a single cell's visual state (used when drawing interactively). */
  setVisualState(index: number, value: number): void {
    this.visualState[index] = value;
  }

  /** Render one frame. Call every requestAnimationFrame tick. */
  render(buffer: Uint8Array): void {
    const { ctx, cols, visualState, activeSet } = this;

    // ── 1. Clear canvas ─────────────────────────────────────────────────────
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // ── 2. Advance visual transitions ────────────────────────────────────────
    const toRemove: number[] = [];
    for (const idx of activeSet) {
      const alive = buffer[idx] === 1;
      if (alive) {
        if (visualState[idx] > 1.0) {
          visualState[idx] = Math.max(1.0, visualState[idx] - FADE_SPEED);
          if (visualState[idx] <= 1.0) toRemove.push(idx);
        } else {
          toRemove.push(idx);
        }
      } else {
        visualState[idx] = Math.max(0, visualState[idx] - FADE_SPEED);
        if (visualState[idx] <= 0) toRemove.push(idx);
      }
    }
    for (const i of toRemove) activeSet.delete(i);

    // ── 3. Batch-draw normal alive cells (uniform style, cheap) ─────────────
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = ALIVE_COLOR;
    ctx.fillStyle = ALIVE_COLOR;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 1 && !activeSet.has(i)) {
        const x = i % cols;
        const y = (i - x) / cols;
        ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_INNER, CELL_INNER);
      }
    }
    ctx.restore();

    // ── 4. Draw birth-flash cells (individually, brighter glow) ─────────────
    for (const idx of activeSet) {
      if (buffer[idx] !== 1) continue;
      const flash = visualState[idx] - 1.0;          // 0–0.8 range
      const t = Math.min(1, flash / 0.8);            // normalise to 0–1
      const r = Math.round(255 * t);
      const g = 255;
      const b = Math.round(136 + (255 - 136) * t);
      const x = idx % cols;
      const y = (idx - x) / cols;

      ctx.save();
      ctx.shadowBlur = 20 + 10 * t;
      ctx.shadowColor = `rgb(${r},${g},${b})`;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_INNER, CELL_INNER);
      ctx.restore();
    }

    // ── 5. Draw dying/fading cells ───────────────────────────────────────────
    for (const idx of activeSet) {
      if (buffer[idx] !== 0) continue;
      const alpha = visualState[idx];
      if (alpha <= 0) continue;
      const x = idx % cols;
      const y = (idx - x) / cols;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = Math.round(8 * alpha);
      ctx.shadowColor = ALIVE_COLOR;
      ctx.fillStyle = ALIVE_COLOR;
      ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_INNER, CELL_INNER);
      ctx.restore();
    }
  }
}
