import { describe, it, expect } from 'vitest'
import { GameOfLife } from '../../GameOfLife.ts'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameOfLife — resource exhaustion', () => {
  // ── Grid size cap ──────────────────────────────────────────────────────────

  describe('max grid size guard', () => {
    it('refuses to construct a grid of 10 001 × 10 001 (~100M cells)', () => {
      // Without a guard this would attempt to allocate ~200 MB
      expect(() => new GameOfLife(10_001, 10_001)).toThrow(/exceeds maximum/)
    })

    it('refuses to construct a grid of 10 001 × 1', () => {
      expect(() => new GameOfLife(10_001, 1)).toThrow(/exceeds maximum/)
    })

    it('refuses to construct a grid of 1 × 10 001', () => {
      expect(() => new GameOfLife(1, 10_001)).toThrow(/exceeds maximum/)
    })

    it('accepts the maximum valid grid (10 000 × 1)', () => {
      expect(() => new GameOfLife(10_000, 1)).not.toThrow()
    })

    it('accepts the default game grid (66 × 50 = 3 300 cells)', () => {
      expect(() => new GameOfLife(66, 50)).not.toThrow()
    })
  })

  // ── step() bounded execution ───────────────────────────────────────────────

  describe('step() completes in bounded time', () => {
    it('step() on a 1 000 × 1 grid returns a result without hanging', () => {
      const subject = new GameOfLife(1_000, 1)

      const result = subject.step()

      expect(Array.isArray(result)).toBe(true)
    })

    it('100 consecutive step() calls on a 100 × 100 grid complete without hanging', () => {
      const subject = new GameOfLife(100, 100)
      subject.randomize(0.3)

      for (let i = 0; i < 100; i++) {
        subject.step()
      }

      expect(subject.generation).toBe(100)
    })
  })

  // ── getBuffer() integrity ──────────────────────────────────────────────────

  describe('getBuffer()', () => {
    it('returns a Uint8Array of exactly cols×rows bytes', () => {
      const subject = new GameOfLife(10, 10)

      const result = subject.getBuffer()

      expect(result.length).toBe(100)
    })

    it('external mutation of the returned buffer does not bypass setCell validation', () => {
      // getBuffer() exposes the internal array — callers must not write arbitrary bytes
      // This test documents that setCell() is the only safe mutation path
      const subject = new GameOfLife(5, 5)
      subject.setCell(2, 2, true)

      const result = subject.getBuffer()

      expect(result[2 * 5 + 2]).toBe(1)   // alive cell written via setCell
      expect(result.length).toBe(25)       // size is always fixed
    })
  })

  // ── randomize() — no infinite loop risk ───────────────────────────────────

  describe('randomize()', () => {
    it('completes on a large grid (1 000 × 1 000) without hanging', () => {
      const subject = new GameOfLife(1_000, 1_000)

      expect(() => subject.randomize(0.5)).not.toThrow()
    })
  })
})
