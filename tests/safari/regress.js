// Regression checks for bugs found in code review, at iPhone 17 size (402×874).
// Usage: BASE=<site url> BROWSER=webkit|chromium node regress.js   (exits non-zero on any failure)
const pw = require('playwright');
const BROWSER = process.env.BROWSER || 'webkit';
const base = (process.env.BASE || 'http://localhost:8765/').replace(/#.*$/, '');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await pw[BROWSER].launch();
  console.log(`${BROWSER} ${b.version()} · ${base}`);
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  const fresh = async (hash = '#today') => { await p.goto(base + hash); await p.evaluate(() => localStorage.clear()); await p.goto('about:blank'); await p.goto(base + hash); await p.waitForTimeout(500); };
  const slips = () => p.evaluate(() => VT.store.logs().filter((l) => l.kind === 'slip'));

  // Double tap on A Slip logs one slip
  await fresh();
  await p.locator('#door-slip').dblclick();
  await p.waitForTimeout(1000);
  ok((await slips()).length === 1, 'double tap logs one slip');

  // Untouched prediction stays empty; note typed right before "I told" survives
  await p.fill('#slip-note', 'rough afternoon');
  await p.locator('#told-btn').click();
  await p.waitForTimeout(300);
  let s1 = (await slips())[0];
  ok(s1.predicted === null, 'no made-up prediction when the slider was never moved');
  ok(s1.note === 'rough afternoon', `note typed just before "I told" is kept (${JSON.stringify(s1.note)})`);
  ok((await p.textContent('#gap-line')) === '', 'no outcome sentence before answering');
  ok((await p.getAttribute('#window-card', 'data-state')) === 'done', 'window shows done');

  // Victory survives a reload (iOS may close the app while waiting for a reply)
  await p.reload(); await p.waitForTimeout(500);
  await p.evaluate(() => (location.hash = '#script')); await p.waitForTimeout(300);
  ok(await p.locator('#victory').isVisible(), 'victory panel is back after a reload');
  await p.locator('#victory-done').click();
  ok(await p.locator('#victory-hint').isVisible(), 'saving without answering asks for the slider');
  await p.locator('#victory-later').click(); await p.waitForTimeout(300);
  ok((await slips())[0].outcomeSkipped === true && !(await p.locator('#victory').isVisible()), '"Not now" sets it aside');
  await p.evaluate(() => (location.hash = '#progress')); await p.waitForTimeout(400);
  ok((await p.locator('#recent-list [data-repair="outcome"]').count()) === 1, 'Recent offers "How did it go?"');
  await p.locator('#recent-list [data-repair="outcome"]').click();
  await p.locator('#dlg-actual').fill('2');
  await p.locator('#disclose-form button[type="submit"]').click(); await p.waitForTimeout(300);
  ok((await slips())[0].actual === 2, 'outcome recorded later from Recent');

  // Prediction lands on the right slip
  await fresh();
  await p.locator('#door-slip').click(); await p.waitForTimeout(1000);
  await p.locator('#predict').fill('7'); await p.waitForTimeout(600);
  ok((await slips())[0].predicted === 7, 'moved prediction is saved before telling');

  // Remove it is offered in the closed state too
  await p.evaluate(() => { const l = VT.store.logs()[0]; VT.store.updateLog(l.id, { windowEndsAt: l.createdAt }); VT.app.render(); });
  ok((await p.getAttribute('#window-card', 'data-state')) === 'closed' && (await p.locator('#window-undo').isVisible()), 'closed window still offers Remove it');

  // Unrepaired slip stays reachable in Recent behind 10+ newer entries
  await p.evaluate(() => { for (let i = 0; i < 12; i++) VT.store.addLog({ date: VT.dates.today(), kind: 'act', actId: 'walk', label: 'Went for a walk', virtues: ['temperance'], status: 'done' }); VT.app.render(); });
  await p.evaluate(() => (location.hash = '#progress')); await p.waitForTimeout(400);
  ok((await p.locator('#recent-list [data-repair="first"]').count()) === 1, 'waiting slip still listed in Recent');

  // Urge panel Save clears the floating nav after opening
  await fresh();
  await p.locator('#door-urge').click(); await p.waitForTimeout(900);
  const hit = await p.evaluate(() => { const r = document.getElementById('save-urge').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && el.closest('#save-urge') ? 'save' : el && el.className; });
  ok(hit === 'save', `Save button is tappable, not under the nav (${hit})`);

  // Accent eyebrows keep their colour
  const col = await p.evaluate(() => [getComputedStyle(document.getElementById('window-eyebrow')).color, getComputedStyle(document.querySelector('.eyebrow:not(.text-twilight)')).color]);
  ok(col[0] !== col[1], `accent eyebrow differs from plain (${col.join(' vs ')})`);

  // One active virtue hides the filter and resets it
  await p.evaluate(() => (location.hash = '#progress')); await p.waitForTimeout(300);
  await p.locator('#journey-filter [data-jv="patience"]').click();
  await p.evaluate(() => { VT.store.updateSettings({ activeVirtues: ['patience'] }); VT.app.render(); });
  ok((await p.locator('#journey-filter').isHidden()) && (await p.textContent('#insight-eyebrow')) === 'All virtues', 'filter hidden and reset with one active virtue');

  // Future check-in week rejected
  await p.evaluate(() => { VT.store.updateSettings({ activeVirtues: VT.VIRTUE_IDS }); VT.app.render(); });
  await p.locator('#weekly-toggle').click();
  await p.evaluate(() => { const w = document.getElementById('week-of'); w.value = '2030-01-07'; w.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.locator('label.choice:has(input[value="initiation"])').click();
  await p.selectOption('#compassion', '4');
  await p.locator('#weekly-form button[type="submit"]').click();
  ok((await p.evaluate(() => VT.store.weeklies().length)) === 0 && (await p.textContent('#weekly-error')).includes('hasn’t started'), 'future week is refused');

  // Acts editor errors show inside the dialog
  await p.evaluate(() => (location.hash = '#today')); await p.waitForTimeout(300);
  await p.locator('#acts-edit').click();
  for (let i = 0; i < 20; i++) await p.locator('#acts-add').click();
  await p.evaluate(() => document.querySelectorAll('#acts-edit-list input').forEach((x, i) => { if (!x.value) x.value = 'Act ' + i; }));
  await p.locator('#acts-form button[type="submit"]').click();
  ok(await p.locator('#acts-error').isVisible(), 'over-limit message shows inside the dialog');
  await p.locator('#acts-cancel').click();

  // Malformed hash still boots; #foundations doesn't jump past the anchors
  await p.goto(base + '#%E0%A4%A'); await p.waitForTimeout(500);
  ok((await p.textContent('#greeting')) !== 'Welcome.', 'malformed hash still boots');
  await p.goto('about:blank'); await p.goto(base + '#foundations'); await p.waitForTimeout(600);
  ok((await p.evaluate(() => window.scrollY)) < 50, 'loading #foundations starts at the top');

  // Duplicate imported ids get their own ids
  const n = await p.evaluate(() => { VT.store.importJSON(JSON.stringify({ logs: [{ id: 'x', date: '2026-10-01', kind: 'urge', stage: 2, virtue: 'temperance' }, { id: 'x', date: '2026-10-02', kind: 'urge', stage: 3, virtue: 'temperance' }] })); const l = VT.store.logs(); VT.store.deleteLog(l[0].id); return VT.store.logs().length; });
  ok(n === 1, 'removing one of two duplicate-id imports removes only one');

  // Absurd imported window is clamped
  const w = await p.evaluate(() => { VT.store.importJSON(JSON.stringify({ logs: [{ id: 'y', date: VT.dates.today(), kind: 'slip', virtue: 'temperance', createdAt: Date.now(), windowEndsAt: 1e15 }] })); const l = VT.store.logs()[0]; return l.windowEndsAt - l.createdAt; });
  ok(w <= 15 * 60 * 1000, 'imported window clamped to 15 minutes');

  // Unreadable saved data is kept aside
  await p.evaluate(() => localStorage.setItem('virtue-tracker:v1', '{"logs":[{"id":'));
  await p.reload(); await p.waitForTimeout(500);
  const kept = await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('virtue-tracker:v1:unreadable-')));
  ok(kept && (await p.locator('#banner').evaluate((e) => e.classList.contains('show'))), 'unreadable data is kept aside and the person is told');

  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
