/**
 * Vitest global setup — polyfills that jsdom 25 omits.
 */

// Path2D — used in Renderer step 3 for batch cell drawing.
// jsdom does not implement Path2D; this stub is sufficient for the security
// tests (they test side-effects and RangeError guards, not pixel output).
if (typeof globalThis.Path2D === 'undefined') {
  class Path2DPolyfill {
    rect(_x: number, _y: number, _w: number, _h: number): void { /* no-op */ }
    moveTo(_x: number, _y: number): void { /* no-op */ }
    lineTo(_x: number, _y: number): void { /* no-op */ }
    arc(_x: number, _y: number, _r: number, _sa: number, _ea: number): void { /* no-op */ }
    closePath(): void { /* no-op */ }
  }
  (globalThis as unknown as Record<string, unknown>).Path2D = Path2DPolyfill;
}
