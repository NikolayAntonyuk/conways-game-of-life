export interface CellChange3D {
  index: number;
  alive: boolean;
}

export interface Rules3D {
  born:    ReadonlyArray<number>;
  survive: ReadonlyArray<number>;
}

export const DEFAULT_RULES_3D: Rules3D = {
  born:    [6],
  survive: [5, 6, 7],
};

const MAX_CELLS = 4_000_000;

export class GameOfLife3D {
  readonly cols:   number;
  readonly rows:   number;
  readonly layers: number;

  private current: Uint8Array;
  private next:    Uint8Array;
  private _generation = 0;

  // O(1) born/survive lookup tables (indexed by neighbour count 0–26)
  private bornSet:    Uint8Array;
  private surviveSet: Uint8Array;

  constructor(cols: number, rows: number, layers: number, rules: Rules3D = DEFAULT_RULES_3D) {
    if (!Number.isInteger(cols)   || cols   <= 0) throw new RangeError('cols must be a positive integer');
    if (!Number.isInteger(rows)   || rows   <= 0) throw new RangeError('rows must be a positive integer');
    if (!Number.isInteger(layers) || layers <= 0) throw new RangeError('layers must be a positive integer');

    const total = cols * rows * layers;
    if (total > MAX_CELLS) {
      throw new RangeError(`Grid (${total} cells) exceeds maximum allowed (${MAX_CELLS})`);
    }

    this.cols   = cols;
    this.rows   = rows;
    this.layers = layers;
    this.current = new Uint8Array(total);
    this.next    = new Uint8Array(total);
    this.bornSet    = new Uint8Array(27);
    this.surviveSet = new Uint8Array(27);
    this.applyRules(rules);
  }

  get generation(): number { return this._generation; }

  setRules(rules: Rules3D): void {
    this.bornSet.fill(0);
    this.surviveSet.fill(0);
    this.applyRules(rules);
  }

  private applyRules(rules: Rules3D): void {
    for (const n of rules.born)    this.bornSet[n]    = 1;
    for (const n of rules.survive) this.surviveSet[n] = 1;
  }

  getCell(x: number, y: number, z: number): boolean {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows || z < 0 || z >= this.layers) return false;
    return this.current[z * this.cols * this.rows + y * this.cols + x] === 1;
  }

  setCell(x: number, y: number, z: number, alive: boolean): void {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows || z < 0 || z >= this.layers) return;
    this.current[z * this.cols * this.rows + y * this.cols + x] = alive ? 1 : 0;
  }

  step(): CellChange3D[] {
    const changes: CellChange3D[] = [];
    const { cols, rows, layers, bornSet, surviveSet } = this;
    const slice = cols * rows;

    for (let z = 0; z < layers; z++) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = z * slice + y * cols + x;
          const alive = this.current[i] === 1;
          const n     = this.countNeighbors(x, y, z);
          const nextAlive = alive ? surviveSet[n] === 1 : bornSet[n] === 1;

          this.next[i] = nextAlive ? 1 : 0;
          if (alive !== nextAlive) changes.push({ index: i, alive: nextAlive });
        }
      }
    }

    // Zero-allocation buffer swap
    const tmp    = this.current;
    this.current = this.next;
    this.next    = tmp;

    this._generation++;
    return changes;
  }

  private countNeighbors(x: number, y: number, z: number): number {
    const { cols, rows, layers, current } = this;
    const slice = cols * rows;
    let n = 0;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const nx = (x + dx + cols)   % cols;
          const ny = (y + dy + rows)   % rows;
          const nz = (z + dz + layers) % layers;
          n += current[nz * slice + ny * cols + nx];
        }
      }
    }
    return n;
  }

  randomize(density = 0.2): void {
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

  getBuffer(): Uint8Array {
    return this.current;
  }
}
