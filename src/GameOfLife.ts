export interface CellChange {
  index: number;
  alive: boolean;
}

const MAX_DIMENSION = 10_000;

export class GameOfLife {
  readonly cols: number;
  readonly rows: number;

  private current: Uint8Array;
  private next: Uint8Array;
  private _generation = 0;

  constructor(cols: number, rows: number) {
    if (!Number.isInteger(cols) || cols <= 0)
      throw new RangeError('cols must be a positive integer');
    if (!Number.isInteger(rows) || rows <= 0)
      throw new RangeError('rows must be a positive integer');
    if (cols > MAX_DIMENSION)
      throw new RangeError(`cols ${cols} exceeds maximum dimension ${MAX_DIMENSION}`);
    if (rows > MAX_DIMENSION)
      throw new RangeError(`rows ${rows} exceeds maximum dimension ${MAX_DIMENSION}`);

    this.cols = cols;
    this.rows = rows;
    this.current = new Uint8Array(cols * rows);
    this.next = new Uint8Array(cols * rows);
  }

  get generation(): number {
    return this._generation;
  }

  getCell(x: number, y: number): boolean {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
    return this.current[y * this.cols + x] === 1;
  }

  setCell(x: number, y: number, alive: boolean): void {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    this.current[y * this.cols + x] = alive ? 1 : 0;
  }

  step(): CellChange[] {
    const changes: CellChange[] = [];
    const { cols, rows } = this;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const alive = this.current[i] === 1;
        const n = this.countNeighbors(x, y);
        const nextAlive = alive ? n === 2 || n === 3 : n === 3;

        this.next[i] = nextAlive ? 1 : 0;
        if (alive !== nextAlive) changes.push({ index: i, alive: nextAlive });
      }
    }

    // swap buffers
    const tmp = this.current;
    this.current = this.next;
    this.next = tmp;

    this._generation++;
    return changes;
  }

  private countNeighbors(x: number, y: number): number {
    const { cols, rows, current } = this;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + cols) % cols;
        const ny = (y + dy + rows) % rows;
        n += current[ny * cols + nx];
      }
    }
    return n;
  }

  randomize(density = 0.3): void {
    if (!Number.isFinite(density) || density < 0 || density > 1)
      throw new RangeError('density must be a finite number in [0, 1]');
    for (let i = 0; i < this.current.length; i++) {
      this.current[i] = Math.random() < density ? 1 : 0;
    }
    this._generation = 0;
  }

  clear(): void {
    this.current.fill(0);
    this.next.fill(0);
    this._generation = 0;
  }

  // ── Preset patterns ───────────────────────────────────────────────────────

  placeGlider(x: number, y: number): void {
    this.place([
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 1],
    ], x, y);
  }

  placePulsar(x: number, y: number): void {
    this.place([
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
    ], x, y);
  }

  placeGosperGliderGun(x: number, y: number): void {
    this.place([
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ], x, y);
  }

  private place(pattern: number[][], ox: number, oy: number): void {
    for (let row = 0; row < pattern.length; row++) {
      for (let col = 0; col < pattern[row].length; col++) {
        if (pattern[row][col] === 1) this.setCell(ox + col, oy + row, true);
      }
    }
  }

  getBuffer(): Uint8Array {
    return this.current;
  }
}
