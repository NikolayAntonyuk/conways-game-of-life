/**
 * Playwright smoke-test for Conway's Game of Life
 * Run with:  node e2e-smoke.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5175';
const results = [];
let browser;

function pass(msg) { results.push({ ok: true,  msg }); console.log(`  ✔  ${msg}`); }
function fail(msg) { results.push({ ok: false, msg }); console.error(`  ✘  ${msg}`); }

try {
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  // ── capture console errors ───────────────────────────────────────────────
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(e.message));

  // ── 1. Page loads ────────────────────────────────────────────────────────
  console.log('\n── Loading app …');
  const res = await page.goto(BASE, { waitUntil: 'networkidle' });
  res.ok() ? pass('HTTP 200') : fail(`HTTP ${res.status()}`);

  // ── 2. Canvas visible ────────────────────────────────────────────────────
  const canvas = page.locator('#gameCanvas');
  await canvas.waitFor({ state: 'visible', timeout: 5000 });
  pass('2D canvas is visible');

  // ── 3. Core buttons present ──────────────────────────────────────────────
  console.log('\n── Checking controls …');
  for (const id of ['playPauseBtn', 'randomizeBtn', 'clearBtn', 'gliderBtn', 'pulsarBtn', 'gosperBtn', 'mode3dBtn', 'hofBtn']) {
    const el = page.locator(`#${id}`);
    const visible = await el.isVisible();
    visible ? pass(`#${id} visible`) : fail(`#${id} NOT visible`);
  }

  // ── 4. Play / Pause toggle ───────────────────────────────────────────────
  console.log('\n── Play/Pause …');
  const btn = page.locator('#playPauseBtn');
  await btn.click();
  const pressed1 = await btn.getAttribute('aria-pressed');
  pressed1 === 'true' ? pass('aria-pressed=true after Play click') : fail(`aria-pressed=${pressed1} (expected true)`);
  await btn.click();
  const pressed2 = await btn.getAttribute('aria-pressed');
  pressed2 === 'false' ? pass('aria-pressed=false after Pause click') : fail(`aria-pressed=${pressed2} (expected false)`);

  // ── 5. Randomize updates generation counter ──────────────────────────────
  console.log('\n── Randomize + generation counter …');
  const genBefore = await page.locator('#genCounter').textContent();
  await page.locator('#randomizeBtn').click();
  await btn.click();  // play
  await page.waitForTimeout(600);
  await btn.click();  // pause
  const genAfter = await page.locator('#genCounter').textContent();
  parseInt(genAfter) > 0 ? pass(`generation counter advanced (${genBefore} → ${genAfter})`) : fail(`generation did not advance (still ${genAfter})`);

  // ── 6. Clear resets counter ──────────────────────────────────────────────
  console.log('\n── Clear …');
  await page.locator('#clearBtn').click();
  const genCleared = await page.locator('#genCounter').textContent();
  genCleared === '000000' ? pass('clear resets generation to 000000') : fail(`clear: expected 000000, got ${genCleared}`);

  // ── 7. Pattern presets ───────────────────────────────────────────────────
  console.log('\n── Pattern presets …');
  for (const id of ['gliderBtn', 'pulsarBtn', 'gosperBtn']) {
    await page.locator(`#${id}`).click();
    pass(`#${id} click did not throw`);
  }

  // ── 8. Hall of Fame modal ────────────────────────────────────────────────
  console.log('\n── Hall of Fame modal …');
  await page.locator('#hofBtn').click();
  const modal = page.locator('#hofModal');
  await modal.waitFor({ state: 'visible', timeout: 2000 });
  pass('Hall of Fame modal opens');
  await page.locator('#hofCloseBtn').click();
  await modal.waitFor({ state: 'hidden', timeout: 2000 });
  pass('Hall of Fame modal closes');

  // ── 9. Escape key closes modal ───────────────────────────────────────────
  await page.locator('#hofBtn').click();
  await modal.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden', timeout: 2000 });
  pass('Escape closes Hall of Fame modal');

  // ── 10. 3D mode toggle ───────────────────────────────────────────────────
  console.log('\n── 3D mode toggle …');
  await page.locator('#mode3dBtn').click();
  await page.waitForTimeout(500);
  const canvas3dVisible = await page.locator('#canvas3d').isVisible();
  const canvas2dHidden  = await page.locator('#gameCanvas').isHidden();
  canvas3dVisible ? pass('3D canvas visible after toggle')   : fail('3D canvas NOT visible');
  canvas2dHidden  ? pass('2D canvas hidden in 3D mode')      : fail('2D canvas NOT hidden');
  const rulesVisible = await page.locator('#rules3dWrap').isVisible();
  rulesVisible ? pass('3D rules row visible') : fail('3D rules row NOT visible');
  // toggle back
  await page.locator('#mode3dBtn').click();
  await page.waitForTimeout(300);
  const back2d = await page.locator('#gameCanvas').isVisible();
  back2d ? pass('2D canvas restored after toggling back') : fail('2D canvas NOT restored');

  // ── 11. Keyboard shortcuts ───────────────────────────────────────────────
  console.log('\n── Keyboard shortcuts …');
  await page.locator('#gameCanvas').click();  // focus canvas area
  await page.keyboard.press('Space');
  const kbPlaying = await btn.getAttribute('aria-pressed');
  kbPlaying === 'true' ? pass('Space key starts game') : fail('Space key did not start game');
  await page.keyboard.press('Space');
  const kbPaused = await btn.getAttribute('aria-pressed');
  kbPaused === 'false' ? pass('Space key pauses game') : fail('Space key did not pause game');
  await page.keyboard.press('KeyC');
  pass('C key (clear) did not throw');
  await page.keyboard.press('KeyR');
  pass('R key (randomize) did not throw');

  // ── 12. No JS console errors ─────────────────────────────────────────────
  console.log('\n── Console errors …');
  consoleErrors.length === 0
    ? pass('no JS console errors')
    : fail(`${consoleErrors.length} console error(s):\n     ${consoleErrors.join('\n     ')}`);

  // ── Screenshot ───────────────────────────────────────────────────────────
  await page.screenshot({ path: 'e2e-screenshot.png', fullPage: false });
  pass('screenshot saved to e2e-screenshot.png');

} catch (err) {
  fail(`Unhandled error: ${err.message}`);
} finally {
  await browser?.close();
}

// ── Summary ─────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${'─'.repeat(52)}`);
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`);
console.log('─'.repeat(52));
process.exit(failed > 0 ? 1 : 0);
