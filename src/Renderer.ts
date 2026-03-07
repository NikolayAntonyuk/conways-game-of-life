import type { CellChange } from './GameOfLife.ts';

const CELL_SIZE  = 12;
const CELL_INNER = 10;          // drawn size (1 px gap on each side)
const ALIVE_COLOR = '#00ff88';
const BG_COLOR = '#0a0a0f';
const FLASH_VALUE = 1.8;        // birth flash start (>1 = extra bright)
const FADE_SPEED = 0.06;        // per animation frame (~60 fps → ~17 frames fade)

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cols: number;

  /** 0 = dead · (0–1] = alive/fading · (1–2] = birth flash */
  private readonly visualState: Float32Array;

  /**
   * 1 = cell is in an active visual transition (flash or fade), 0 = stable.
   * Uint8Array gives O(1) lookup with a direct index — no hash, no Set overhead.
   */
  private readonly activeFlags: Uint8Array;

  /**
   * Pre-allocated list of active cell indices.
   * Compacted in-place each render frame — zero heap allocation per frame.
   */
  private readonly activeList: Int32Array;

  /** Number of valid entries currently in activeList. */
  private activeCount = 0;

  constructor(canvas: HTMLCanvasElement, cols: number, rows: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot acquire 2D context');
    this.ctx = ctx;
    this.cols = cols;
    const total = cols * rows;
    this.visualState = new Float32Array(total);
    this.activeFlags  = new Uint8Array(total);
    this.activeList   = new Int32Array(total);
  }

  /** True while flash / fade transitions are still running. */
  get hasPendingTransitions(): boolean {
    return this.activeCount > 0;
  }

  /** Call after every game.step() to register born/died cells. */
  applyChanges(changes: CellChange[]): void {
    const total = this.visualState.length;
    for (const { index, alive } of changes) {
      if (index < 0 || index >= total)
        throw new RangeError(`Cell index ${index} out of bounds [0, ${total})`);
      if (alive) this.visualState[index] = FLASH_VALUE;
      // Dead cells keep their current visualState and start fading in render().
      if (this.activeFlags[index] === 0) {
        this.activeFlags[index] = 1;
        this.activeList[this.activeCount++] = index;
      }
    }
  }

  /** Reset visual state to match buffer (after randomize / clear). */
  syncVisualState(buffer: Uint8Array): void {
    if (buffer.length !== this.visualState.length) {
      throw new RangeError(`Buffer length ${buffer.length} does not match grid size ${this.visualState.length}`);
    }
    for (let i = 0; i < buffer.length; i++) {
      this.visualState[i] = buffer[i] === 1 ? 1.0 : 0.0;
    }
    this.activeFlags.fill(0);
    this.activeCount = 0;
  }

  /** Set a single cell's visual state (used when drawing interactively). */
  setVisualState(index: number, value: number): void {
    if (index < 0 || index >= this.visualState.length) {
      throw new RangeError(`Cell index ${index} out of bounds [0, ${this.visualState.length})`);
    }
    this.visualState[index] = value;
  }

  /** Render one frame. Call every requestAnimationFrame tick. */
  render(buffer: Uint8Array): void {
    if (buffer.length !== this.visualState.length) {
      throw new RangeError(`Buffer length ${buffer.length} does not match grid size ${this.visualState.length}`);
    }
    const { ctx, cols, visualState, activeFlags, activeList } = this;

    // ── 1. Clear canvas ─────────────────────────────────────────────────────
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // ── 2. Advance transitions — in-place compaction, zero allocation ────────
    let count = this.activeCount;
    let newCount = 0;
    for (let j = 0; j < count; j++) {
      const idx = activeList[j];
      const alive = buffer[idx] === 1;
      let keep: boolean;
      if (alive) {
        if (visualState[idx] > 1.0) {
          visualState[idx] = Math.max(1.0, visualState[idx] - FADE_SPEED);
        }
        keep = visualState[idx] > 1.0;
      } else {
        visualState[idx] = Math.max(0, visualState[idx] - FADE_SPEED);
        keep = visualState[idx] > 0;
      }
      if (keep) {
        activeList[newCount++] = idx;
      } else {
        activeFlags[idx] = 0;
      }
    }
    this.activeCount = count = newCount;

    // ── 3. Batch-draw all stable alive cells — single Path2D fill ────────────
    // One path.rect() per alive cell; one ctx.fill(path) = one GPU draw call.
    // shadowBlur is paid once for the entire path, not once per cell.
    const path = new Path2D();
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 1 && activeFlags[i] === 0) {
        const x = i % cols;
        const y = (i - x) / cols;
        path.rect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_INNER, CELL_INNER);
      }
    }
    ctx.save();
    ctx.shadowBlur  = 10;
    ctx.shadowColor = ALIVE_COLOR;
    ctx.fillStyle   = ALIVE_COLOR;
    ctx.fill(path);
    ctx.restore();

    // ── 4. Draw birth-flash cells (individually, brighter glow) ─────────────
    for (let j = 0; j < count; j++) {
      const idx = activeList[j];
      if (buffer[idx] !== 1) continue;
      const flash = visualState[idx] - 1.0;          // 0–0.8 range
      const t = Math.min(1, flash / 0.8);            // normalise to 0–1
      const r = Math.round(255 * t);
      const g = 255;
      const b = Math.round(136 + (255 - 136) * t);
      const x = idx % cols;
      const y = (idx - x) / cols;

      ctx.save();
      ctx.shadowBlur  = 20 + 10 * t;
      ctx.shadowColor = `rgb(${r},${g},${b})`;
      ctx.fillStyle   = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_INNER, CELL_INNER);
      ctx.restore();
    }

    // ── 5. Draw dying/fading cells ───────────────────────────────────────────
    for (let j = 0; j < count; j++) {
      const idx = activeList[j];
      if (buffer[idx] !== 0) continue;
      const alpha = visualState[idx];
      if (alpha <= 0) continue;
      const x = idx % cols;
      const y = (idx - x) / cols;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = Math.round(8 * alpha);
      ctx.shadowColor = ALIVE_COLOR;
      ctx.fillStyle   = ALIVE_COLOR;
      ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_INNER, CELL_INNER);
      ctx.restore();
    }
  }
}
