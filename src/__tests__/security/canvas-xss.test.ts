import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Renderer } from '../../Renderer.ts'
import { GameOfLife } from '../../GameOfLife.ts'

// ── Builders ─────────────────────────────────────────────────────────────────

const COLS = 10
const ROWS = 10
const TOTAL = COLS * ROWS

function buildRenderer(): { renderer: Renderer; canvas: HTMLCanvasElement } {
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
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  }

  vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as unknown as GPUCanvasContext)
  return { renderer: new Renderer(canvas, COLS, ROWS), canvas }
}

function buildBuffer(fill = 0): Uint8Array {
  return new Uint8Array(TOTAL).fill(fill)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Renderer — XSS and unsafe code execution', () => {
  let originalInnerHTML: string

  beforeEach(() => {
    originalInnerHTML = document.body.innerHTML
  })

  afterEach(() => {
    document.body.innerHTML = originalInnerHTML
    vi.restoreAllMocks()
  })

  // ── No HTML injection ──────────────────────────────────────────────────────

  describe('canvas-only rendering (no innerHTML)', () => {
    it('render() does not mutate document.body.innerHTML', () => {
      const { renderer } = buildRenderer()

      renderer.render(buildBuffer(1))

      expect(document.body.innerHTML).toBe(originalInnerHTML)
    })

    it('render() does not inject HTML after applyChanges with born cells', () => {
      const { renderer } = buildRenderer()
      renderer.applyChanges([{ index: 0, alive: true }])

      renderer.render(buildBuffer(1))

      expect(document.body.innerHTML).toBe(originalInnerHTML)
      expect(document.body.innerHTML).not.toContain('<script')
      expect(document.body.innerHTML).not.toContain('onerror')
    })

    it('render() does not inject HTML after applyChanges with dying cells', () => {
      const { renderer } = buildRenderer()
      renderer.syncVisualState(buildBuffer(1))
      renderer.applyChanges([{ index: 0, alive: false }])

      renderer.render(buildBuffer(0))

      expect(document.body.innerHTML).toBe(originalInnerHTML)
    })

    it('does not call document.write at any point', () => {
      const writeSpy = vi.spyOn(document, 'write')
      const { renderer } = buildRenderer()

      renderer.render(buildBuffer(1))

      expect(writeSpy).not.toHaveBeenCalled()
    })
  })

  // ── No eval / dynamic code execution ──────────────────────────────────────

  describe('no unsafe code execution', () => {
    it('render() does not call eval', () => {
      const evalSpy = vi.spyOn(globalThis, 'eval')
      const { renderer } = buildRenderer()

      renderer.render(buildBuffer(1))

      expect(evalSpy).not.toHaveBeenCalled()
    })

    it('render() with birth-flash cells does not call eval', () => {
      const evalSpy = vi.spyOn(globalThis, 'eval')
      const { renderer } = buildRenderer()
      renderer.applyChanges([{ index: 0, alive: true }])

      renderer.render(buildBuffer(1))

      expect(evalSpy).not.toHaveBeenCalled()
    })

    it('GameOfLife.step() does not call eval', () => {
      const evalSpy = vi.spyOn(globalThis, 'eval')
      const subject = new GameOfLife(COLS, ROWS)
      subject.randomize(0.3)

      subject.step()

      expect(evalSpy).not.toHaveBeenCalled()
    })

    it('GameOfLife.randomize() does not call eval', () => {
      const evalSpy = vi.spyOn(globalThis, 'eval')
      const subject = new GameOfLife(COLS, ROWS)

      subject.randomize(0.5)

      expect(evalSpy).not.toHaveBeenCalled()
    })
  })

  // ── XSS payload in synthetic cell data ────────────────────────────────────

  describe('XSS payload cannot escape the canvas boundary', () => {
    it('a live buffer containing all 1s renders without touching innerHTML', () => {
      // Simulates attacker-controlled cell data that is maximally "active"
      const { renderer } = buildRenderer()
      const xssBuffer = new Uint8Array(TOTAL).fill(1)

      renderer.applyChanges(
        Array.from({ length: TOTAL }, (_, i) => ({ index: i, alive: true }))
      )
      renderer.render(xssBuffer)

      expect(document.body.innerHTML).toBe(originalInnerHTML)
      expect(document.body.innerHTML).not.toContain('<img')
      expect(document.body.innerHTML).not.toContain('alert')
    })

    it('syncVisualState on a fully-alive buffer does not touch innerHTML', () => {
      const { renderer } = buildRenderer()

      renderer.syncVisualState(new Uint8Array(TOTAL).fill(1))

      expect(document.body.innerHTML).toBe(originalInnerHTML)
    })
  })
})
