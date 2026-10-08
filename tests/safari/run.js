// Interaction + screenshot suite at iPhone 17 size (402×874 CSS px).
// Usage: BASE=<site url> OUT=<dir> BROWSER=webkit|chromium node run.js
// Prints PASS/FAIL lines; exits non-zero if anything fails or the page logs an error.
const pw = require('playwright');
const fs = require('fs');
const seed = require('./seed.js');

const BASE = (process.env.BASE || 'http://localhost:8765/').replace(/#.*$/, '');
const OUT = process.env.OUT || 'results';
const BROWSER = process.env.BROWSER || 'webkit';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
};

async function suite(browser, scheme) {
  const out = `${OUT}/${scheme}`;
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    isMobile: BROWSER !== 'firefox',
    hasTouch: true,
    colorScheme: scheme,
    userAgent: IPHONE_UA,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errs.push('console: ' + m.text()));
  p.on('dialog', (d) => d.accept());
  const shot = (n, fullPage = false) => p.screenshot({ path: `${out}/${n}.png`, fullPage });
  const tap = async (sel) => {
    await p.locator(sel).first().click();
    await p.waitForTimeout(250);
  };
  const go = async (hash) => {
    await p.evaluate((h) => (location.hash = h), hash);
    await p.waitForTimeout(450);
  };
  const top = (y) => p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
  const overflow = async (name) => {
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
    ok(r.sw <= r.w, `[${scheme}] ${name}: no sideways scroll (${r.sw}/${r.w})`);
  };

  await p.goto(BASE + '#today', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(800);
  ok((await p.evaluate(() => typeof VT === 'object' && !!VT.app)), `[${scheme}] app booted`);
  await shot('01-today-empty');
  await overflow('today');

  // Good act + urge
  await tap('#act-chips [data-act]');
  ok(await p.locator('#act-followup').isVisible(), `[${scheme}] act follow-up opens`);
  await tap('#act-rate [data-rate="4"]');
  await tap('#door-urge');
  await tap('#stage-options [data-stage="2"]');
  await tap('#need-chips [data-need="rest"]');
  await tap('#alt-chips [data-alt]');
  await shot('02-urge-open');
  await tap('#save-urge');
  ok((await p.evaluate(() => VT.store.logs().length)) === 3, `[${scheme}] act, urge and chosen act saved`);

  // Slip → Honest Script
  await tap('#door-slip');
  await p.waitForTimeout(250);
  await shot('03-banner');
  await p.waitForTimeout(1000);
  ok((await p.evaluate(() => location.hash)) === '#script', `[${scheme}] slip opens Honest Script`);
  ok((await p.getAttribute('#window-card', 'data-state')) === 'running', `[${scheme}] window running`);
  const t1 = await p.textContent('#ring-time');
  await p.waitForTimeout(1300);
  const t2 = await p.textContent('#ring-time');
  ok(t1 !== t2, `[${scheme}] ring counts down (${t1} → ${t2})`);
  await top(0);
  await shot('04-script-top');
  await overflow('script');
  await tap('#feel-chips [data-feel="lonely"]');
  await p.waitForTimeout(300);
  ok((await p.inputValue('#script-output')).includes('lonely'), `[${scheme}] message follows the chips`);
  ok((await p.getAttribute('#text-btn', 'href')).startsWith('sms:'), `[${scheme}] text button is an sms: link`);
  await p.locator('#predict').fill('8');
  await p.waitForTimeout(600);
  await p.locator('#predict-card').scrollIntoViewIfNeeded();
  await shot('05-script-predict');
  await tap('#told-btn');
  ok(await p.locator('#victory').isVisible(), `[${scheme}] double victory`);
  await p.locator('#actual').fill('3');
  await shot('06-victory');
  await tap('#victory-done');
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => location.hash)) === '#progress', `[${scheme}] save goes to Progress`);
  ok((await p.evaluate(() => VT.store.logs().find((l) => l.kind === 'slip').actual)) === 3, `[${scheme}] outcome saved`);

  // Seeded data for the charts
  await p.evaluate(`VT.store.importJSON((${seed.toString()})()); VT.app.render();`);
  await go('#progress');
  await top(0);
  await shot('07-progress-top');
  await overflow('progress');
  ok((await p.locator('#fear-chart svg').count()) === 1, `[${scheme}] fear chart drawn`);
  ok((await p.locator('#crowd-chart svg').count()) === 1, `[${scheme}] crowding chart drawn`);
  ok((await p.locator('#friction-chart svg').count()) === 1, `[${scheme}] friction chart drawn`);
  for (const [sel, name] of [['#fear-chart', '08-fear'], ['#crowd-chart', '09-crowd'], ['#weekly-card', '10-weekly'], ['#settings-card', '11-settings']]) {
    await p.locator(sel).scrollIntoViewIfNeeded();
    await p.waitForTimeout(150);
    await shot(name);
  }
  await tap('#weekly-toggle');
  await p.locator('label.choice:has(input[value="initiation"])').click();
  await p.selectOption('#compassion', '4');
  await tap('#weekly-form button[type="submit"]');
  ok(await p.locator('#weekly-feedback').isVisible(), `[${scheme}] weekly check-in saves`);

  await go('#today');
  await top(0);
  await shot('12-today-seeded');
  await go('#foundations');
  await overflow('foundations');
  await shot('13-foundations');
  await p.locator('details.foundation > summary').nth(1).click();
  await p.waitForTimeout(300);
  const pinned = await p.evaluate(async () => {
    const d = document.querySelectorAll('details.foundation')[1];
    window.scrollTo({ top: window.scrollY + d.getBoundingClientRect().top + 500, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 200));
    return Math.round(d.querySelector('summary').getBoundingClientRect().top);
  });
  ok(Math.abs(pinned) <= 2, `[${scheme}] open section title stays pinned (top ${pinned})`);
  await shot('14-foundation-open');

  ok(!errs.length, `[${scheme}] no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  const browser = await pw[BROWSER].launch();
  console.log(`${BROWSER} ${browser.version()} · ${BASE}`);
  for (const scheme of ['light', 'dark']) {
    try {
      await suite(browser, scheme);
    } catch (e) {
      ok(false, `[${scheme}] suite crashed: ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
