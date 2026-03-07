export interface HallOfFameRecord {
  highScore:  number;     // generation count at time of record
  startGrid:  number[];   // alive cell indices at generation 0 of that run
  timestamp:  number;     // Date.now() when the record was set
}

const STORAGE_KEY = 'conways-hall-of-fame';

export function loadRecord(): HallOfFameRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof (parsed as Record<string, unknown>).highScore  !== 'number'  ||
      !Array.isArray((parsed as Record<string, unknown>).startGrid)       ||
      typeof (parsed as Record<string, unknown>).timestamp !== 'number'
    ) return null;
    return parsed as HallOfFameRecord;
  } catch {
    return null;
  }
}

/**
 * Saves a new record only when `generation` exceeds the stored high score.
 * Returns `true` if a new record was written, `false` otherwise.
 */
export function tryUpdateHighScore(generation: number, startBuffer: Uint8Array): boolean {
  if (generation <= 0) return false;
  const existing = loadRecord();
  if (existing && existing.highScore >= generation) return false;

  const startGrid: number[] = [];
  for (let i = 0; i < startBuffer.length; i++) {
    if (startBuffer[i] === 1) startGrid.push(i);
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ highScore: generation, startGrid, timestamp: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}
