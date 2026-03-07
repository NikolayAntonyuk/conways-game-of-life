import { describe, it, expect, vi } from 'vitest'
import { Renderer } from '../../Renderer.ts'

// ── Builders ─────────────────────────────────────────────────────────────────

const COLS = 10
const ROWS = 10
const TOTAL = COLS * ROWS

function buildRenderer(): Renderer {
  const canvas = document.createElement('canvas')
  canvas.width = COLS * 12
  canvas.height = ROWS * 12

  const mockCtx = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    shadowBlur: 0,
    shadowColor: '',
    globalAlpha: 1,
    get canvas() { return canvas },
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  }

  vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as GPUCanvasContext)
  return new Renderer(canvas, COLS, ROWS)
}

function buildBuffer(size = TOTAL): Uint8Array {
  return new Uint8Array(size)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Renderer — bounds safety', () => {
  // ── setVisualState ─────────────────────────────────────────────────────────

  describe('setVisualState', () => {
    it('rejects negative index', () => {
      const subject = buildRenderer()

      expect(() => subject.setVisualState(-1, 1.0)).toThrow(RangeError)
    })

    it('rejects index equal to cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.setVisualState(TOTAL, 1.0)).toThrow(RangeError)
    })

    it('rejects index greater than cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.setVisualState(TOTAL + 99, 1.0)).toThrow(RangeError)
    })

    it('accepts index 0', () => {
      const subject = buildRenderer()

      expect(() => subject.setVisualState(0, 1.0)).not.toThrow()
    })

    it('accepts last valid index (cols*rows - 1)', () => {
      const subject = buildRenderer()

      expect(() => subject.setVisualState(TOTAL - 1, 1.0)).not.toThrow()
    })
  })

  // ── applyChanges ───────────────────────────────────────────────────────────

  describe('applyChanges', () => {
    it('rejects change with negative index', () => {
      const subject = buildRenderer()

      expect(() => subject.applyChanges([{ index: -1, alive: true }])).toThrow(RangeError)
    })

    it('rejects change with index >= cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.applyChanges([{ index: TOTAL, alive: true }])).toThrow(RangeError)
    })

    it('rejects any out-of-bounds index in a batch', () => {
      const subject = buildRenderer()

      expect(() =>
        subject.applyChanges([
          { index: 0, alive: true },
          { index: TOTAL, alive: false },   // the bad one
        ])
      ).toThrow(RangeError)
    })

    it('accepts valid changes', () => {
      const subject = buildRenderer()

      expect(() =>
        subject.applyChanges([
          { index: 0, alive: true },
          { index: TOTAL - 1, alive: false },
        ])
      ).not.toThrow()
    })
  })

  // ── syncVisualState ────────────────────────────────────────────────────────

  describe('syncVisualState', () => {
    it('rejects buffer larger than cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.syncVisualState(buildBuffer(TOTAL + 1))).toThrow(RangeError)
    })

    it('rejects buffer smaller than cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.syncVisualState(buildBuffer(TOTAL - 1))).toThrow(RangeError)
    })

    it('accepts buffer of exactly cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.syncVisualState(buildBuffer(TOTAL))).not.toThrow()
    })
  })

  // ── render ─────────────────────────────────────────────────────────────────

  describe('render', () => {
    it('rejects buffer with size different from cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.render(buildBuffer(TOTAL + 1))).toThrow(RangeError)
    })

    it('accepts buffer of exactly cols*rows', () => {
      const subject = buildRenderer()

      expect(() => subject.render(buildBuffer(TOTAL))).not.toThrow()
    })
  })
})
