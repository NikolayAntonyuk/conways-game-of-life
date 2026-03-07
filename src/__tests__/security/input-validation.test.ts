import { describe, it, expect } from 'vitest'
import { GameOfLife } from '../../GameOfLife.ts'

// ── Builders ─────────────────────────────────────────────────────────────────

function buildGame(cols = 10, rows = 10): GameOfLife {
  return new GameOfLife(cols, rows)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameOfLife — input validation', () => {
  // ── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('rejects negative cols', () => {
      expect(() => new GameOfLife(-1, 50)).toThrow()
    })

    it('rejects negative rows', () => {
      expect(() => new GameOfLife(66, -1)).toThrow()
    })

    it('rejects zero cols', () => {
      expect(() => new GameOfLife(0, 50)).toThrow()
    })

    it('rejects zero rows', () => {
      expect(() => new GameOfLife(66, 0)).toThrow()
    })

    it('rejects NaN cols', () => {
      expect(() => new GameOfLife(NaN, 50)).toThrow()
    })

    it('rejects NaN rows', () => {
      expect(() => new GameOfLife(66, NaN)).toThrow()
    })

    it('rejects Infinity cols', () => {
      expect(() => new GameOfLife(Infinity, 50)).toThrow()
    })

    it('rejects Infinity rows', () => {
      expect(() => new GameOfLife(66, Infinity)).toThrow()
    })

    it('rejects non-integer cols', () => {
      expect(() => new GameOfLife(1.5, 50)).toThrow()
    })

    it('rejects non-integer rows', () => {
      expect(() => new GameOfLife(66, 1.5)).toThrow()
    })

    it('rejects cols exceeding MAX_DIMENSION (10 000)', () => {
      expect(() => new GameOfLife(10_001, 50)).toThrow(/exceeds maximum/)
    })

    it('rejects rows exceeding MAX_DIMENSION (10 000)', () => {
      expect(() => new GameOfLife(66, 10_001)).toThrow(/exceeds maximum/)
    })

    it('accepts valid integer dimensions', () => {
      const subject = buildGame(66, 50)

      expect(subject.cols).toBe(66)
      expect(subject.rows).toBe(50)
    })
  })

  // ── randomize ──────────────────────────────────────────────────────────────

  describe('randomize', () => {
    it('rejects density below 0', () => {
      const subject = buildGame()

      expect(() => subject.randomize(-0.1)).toThrow()
    })

    it('rejects density above 1', () => {
      const subject = buildGame()

      expect(() => subject.randomize(1.1)).toThrow()
    })

    it('rejects NaN density', () => {
      const subject = buildGame()

      expect(() => subject.randomize(NaN)).toThrow()
    })

    it('rejects Infinity density', () => {
      const subject = buildGame()

      expect(() => subject.randomize(Infinity)).toThrow()
    })

    it('accepts density 0 — all cells dead', () => {
      const subject = buildGame()

      subject.randomize(0)

      expect(subject.getCell(5, 5)).toBe(false)
    })

    it('accepts density 1 — all cells alive', () => {
      const subject = buildGame()

      subject.randomize(1)

      expect(subject.getCell(5, 5)).toBe(true)
    })

    it('accepts default density 0.3', () => {
      const subject = buildGame()

      expect(() => subject.randomize()).not.toThrow()
    })
  })

  // ── setCell / getCell ──────────────────────────────────────────────────────

  describe('setCell / getCell boundary safety', () => {
    it('ignores setCell with negative coordinates — no crash', () => {
      const subject = buildGame()

      expect(() => subject.setCell(-1, 0, true)).not.toThrow()
      expect(() => subject.setCell(0, -1, true)).not.toThrow()
    })

    it('ignores setCell with out-of-bounds coordinates — no crash', () => {
      const subject = buildGame()

      expect(() => subject.setCell(100, 0, true)).not.toThrow()
      expect(() => subject.setCell(0, 100, true)).not.toThrow()
    })

    it('getCell returns false for out-of-bounds coordinates — no crash', () => {
      const subject = buildGame()

      const result = subject.getCell(999, 999)

      expect(result).toBe(false)
    })
  })
})
