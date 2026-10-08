// App controller: tabs, theme, Progress (insight, charts, weekly check-in, recent, settings & data),
// Foundations, and the dialog for a repair made later.
(function () {
  const { $, toast } = VT.ui;
  const RECENT_LIMIT = 10;
  const TABS = ['today', 'script', 'progress', 'foundations'];
  // Hashes from the earlier five-tab layout still land somewhere sensible.
  const LEGACY = { honesty: 'script', journey: 'progress', weekly: 'progress', why: 'foundations' };
  const THEME_COLORS = { light: '#f5f1ea', dark: '#121824' };

  let tab = null;
  let journeyVirtue = null; // null = all
  let energyTouched = false; // once the person picks an energy answer, stop pre-filling it
  let weekTouched = false; // the check-in week was picked by hand; otherwise it follows the current week
  let disclosing = null; // { id, outcomeOnly }
  let charts = null; // latest chart data, drawn when Progress is visible
  let chartWidth = 0;

  // Move without the page-wide smooth scrolling (which would animate across the whole page).
  function jumpTo(y) {
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    root.style.scrollBehavior = prev;
  }

  // ---------- Tabs ----------
  function moveIndicator(animate = true) {
    const link = document.querySelector(`.nav [data-tab-link="${tab}"]`);
    const ind = $('nav-ind');
    if (!link) return;
    ind.classList.toggle('no-anim', !animate);
    ind.style.width = `${link.offsetWidth}px`;
    ind.style.transform = `translateX(${link.offsetLeft}px)`;
  }

  function showTab(hash, { scroll = true } = {}) {
    let name = LEGACY[hash] || hash;
    if (!TABS.includes(name)) name = 'today';
    const first = tab == null;
    tab = name;
    document.body.dataset.tab = name;
    document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
    document.querySelectorAll('[data-tab-link]').forEach((a) => {
      const on = a.dataset.tabLink === name;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    moveIndicator(!first);
    if (scroll) jumpTo(0);
    if (name === 'progress') {
      prefillEnergy();
      drawCharts(true);
    }
    if (name === 'script') VT.honesty.onShow();
    if (hash === 'weekly') {
      openWeekly(true);
      requestAnimationFrame(() => $('weekly-card').scrollIntoView({ block: 'start' }));
    }
  }

  function tabFromHash() {
    const h = location.hash.replace('#', '');
    try {
      return decodeURIComponent(h);
    } catch (e) {
      return h; // a malformed link must never stop the app from starting
    }
  }

  function onTabClick(e) {
    const link = e.target.closest('[data-tab-link]');
    // Tapping the tab you're already on scrolls back to the top, like a native tab bar.
    if (link && link.dataset.tabLink === tab) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ---------- Theme ----------
  function applyTheme(pref) {
    const root = document.documentElement;
    if (pref === 'light' || pref === 'dark') root.setAttribute('data-theme', pref);
    else root.removeAttribute('data-theme');
    // Keep the browser chrome / status bar in step with the page.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      const dark = pref === 'dark' || (pref !== 'light' && (m.getAttribute('media') || '').includes('dark'));
      m.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
    });
  }

  // ---------- Render ----------
  // Re-rendering rebuilds buttons; put keyboard / VoiceOver focus back on the matching one afterwards.
  function focusKey() {
    const el = document.activeElement;
    if (!el || el === document.body || !el.closest('main, .nav')) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const box = el.closest('[id]');
    const attr = [...el.attributes].find((a) => a.name.startsWith('data-') && a.name !== 'data-f');
    return box && attr ? `#${CSS.escape(box.id)} [${attr.name}="${CSS.escape(attr.value)}"]` : null;
  }

  function render() {
    const key = focusKey();
    draw();
    const now = document.activeElement;
    if (key && (!now || now === document.body)) {
      const target = document.querySelector(key);
      if (target && target.offsetParent) target.focus({ preventScroll: true });
    }
  }

  function draw() {
    const logs = VT.store.logs();
    const weeklies = VT.store.weeklies();
    const s = VT.store.settings();
    if (journeyVirtue && (s.activeVirtues.length < 2 || !s.activeVirtues.includes(journeyVirtue))) journeyVirtue = null;

    const overall = VT.insights.summary(logs, weeklies, null, s.activeVirtues);
    const h = VT.insights.honesty(logs);
    const due = VT.insights.checkInDue(weeklies);
    const ctx = { logs, weeklies, settings: s, overall, honesty: h, due };

    VT.today.render(ctx);
    VT.honesty.render(ctx);
    renderProgress(ctx);
    renderSettings(s);
    renderAnchors(s);
    syncWeekDate();
  }

  // ---------- Progress ----------
  function renderProgress({ logs, weeklies, settings: s, overall, honesty: h, due }) {
    const filter = $('journey-filter');
    filter.innerHTML = '';
    const opt = (id, label, color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.jv = id;
      b.setAttribute('aria-pressed', String((journeyVirtue || '') === id));
      b.innerHTML = color ? '<span class="vdot"></span><span></span>' : '<span></span>';
      if (color) b.firstChild.style.background = color;
      b.lastChild.textContent = label;
      filter.appendChild(b);
    };
    opt('', 'All');
    s.activeVirtues.forEach((id) => opt(id, VT.virtueById(id).name, VT.virtueById(id).color));
    filter.hidden = s.activeVirtues.length < 2;

    const sum = journeyVirtue ? VT.insights.summary(logs, weeklies, journeyVirtue, s.activeVirtues) : overall;
    const v = journeyVirtue ? VT.virtueById(journeyVirtue) : null;
    $('insight-eyebrow').textContent = v ? `${v.name} · ${v.area}` : 'All virtues';
    $('insight-phase').textContent = sum.phase;
    $('insight-message').textContent = sum.message;
    $('phase-marker').style.left = `${VT.ui.clampPct(sum.score)}%`;
    $('phase-marker').style.opacity = sum.score == null ? '0.35' : '1';

    const paths = $('insight-paths');
    paths.innerHTML = '';
    paths.classList.toggle('hidden', !!journeyVirtue || s.activeVirtues.length < 2);
    sum.perVirtue.forEach((p) => {
      const vv = VT.virtueById(p.id);
      const li = document.createElement('li');
      li.className = 'flex items-center gap-2';
      li.innerHTML = '<span class="vdot"></span><span class="font-medium" data-f="n"></span><span class="text-dim" data-f="p"></span>';
      li.querySelector('.vdot').style.background = vv.color;
      li.querySelector('[data-f="n"]').textContent = vv.name;
      li.querySelector('[data-f="p"]').textContent = `· ${p.phase}`;
      paths.appendChild(li);
    });

    $('stat-acts').textContent = sum.acts30;
    $('stat-urges').textContent = sum.urges30;
    $('stat-shared').textContent = h.slips30 ? `${h.shared30}/${h.slips30}` : '0';
    $('stat-friction').textContent = sum.latestFriction == null ? '—' : sum.latestFriction;

    $('fear-summary').textContent = h.fear;
    $('honesty-message').textContent = h.message;
    $('honesty-streak').textContent = h.streak > 1 ? `${h.streak} slips in a row made right.` : h.streak === 1 ? 'Your most recent slip was made right.' : '';

    const el = $('weekly-due');
    if (due == null) el.textContent = 'First check-in';
    else if (due > 1) el.textContent = `Next one in ${due} days`;
    else if (due === 1) el.textContent = 'Next one tomorrow';
    else el.textContent = 'Ready when you are';

    // "All virtues" means the active ones; a resting virtue's history stays out of the totals.
    const scoped = journeyVirtue ? logs : VT.insights.activeScope(logs, s.activeVirtues);
    const a = VT.insights.acts(scoped, s, journeyVirtue);
    charts = { pairs: h.pairs, weeks: a.weeks, weeklies, ids: journeyVirtue ? [journeyVirtue] : s.activeVirtues, counts: sum.counts };
    drawCharts(true);
    renderHelps(a);
    renderRecent(logs.filter((l) => VT.inVirtue(l, journeyVirtue)), logs);
  }

  // Charts are drawn at their real width, so only while Progress is on screen (and again on resize).
  function drawCharts(force) {
    if (tab !== 'progress' || !charts) return;
    const w = $('fear-chart').clientWidth;
    if (!force && w === chartWidth) return;
    chartWidth = w;
    VT.charts.fear($('fear-chart'), charts.pairs);
    VT.charts.crowd($('crowd-chart'), charts.weeks);
    VT.charts.friction($('friction-chart'), $('friction-legend'), charts.weeklies, charts.ids);
    VT.charts.stages($('stage-bar'), charts.counts);
  }

  function bars(list, rows, color) {
    list.innerHTML = '';
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'hbar-row';
      li.innerHTML = '<div class="hbar-head"><span data-f="l"></span><span data-f="v"></span></div><div class="hbar"><i></i></div>';
      li.querySelector('[data-f="l"]').textContent = r.label;
      li.querySelector('[data-f="v"]').textContent = r.value;
      const fill = li.querySelector('i');
      fill.style.width = `${Math.max(4, r.pct)}%`;
      fill.style.background = color;
      list.appendChild(li);
    });
  }

  function renderHelps(a) {
    bars(
      $('lift-bars'),
      a.liftByAct.slice(0, 8).map((x) => ({ label: x.label, value: `${VT.round1(x.avg)} / 5 · ${x.n}×`, pct: (x.avg / 5) * 100 })),
      VT.ACT.color
    );
    $('helps-summary').textContent = a.helps;
    $('needs-wrap').classList.toggle('hidden', !a.needs.length);
    const max = Math.max(1, ...a.needs.map((n) => n.count));
    bars(
      $('need-bars'),
      a.needs.map((n) => ({ label: `${n.name} · ${n.hint}`, value: String(n.count), pct: (n.count / max) * 100 })),
      VT.FIGHT_COLOR
    );
    $('needs-summary').textContent = a.needsMsg;
  }

  function renderRecent(logs, allLogs) {
    const list = $('recent-list');
    list.innerHTML = '';
    const newest = [...logs].reverse();
    // A slip still waiting to be made right stays reachable however much has been logged since.
    const waiting = (l) => l.kind === 'slip' && !l.disclosed && VT.virtueById(l.virtue).repairs.length > 0;
    const recent = newest.slice(0, RECENT_LIMIT);
    newest.slice(RECENT_LIMIT).filter(waiting).forEach((l) => recent.push(l));
    $('recent-empty').classList.toggle('hidden', recent.length > 0);
    $('recent-count').textContent = logs.length > RECENT_LIMIT ? `latest ${RECENT_LIMIT} of ${logs.length}` : '';
    const weekAgo = Date.now() - 7 * 86400000;

    recent.forEach((l) => {
      const li = document.createElement('li');
      li.className = 'py-3 flex gap-3 items-start';
      li.innerHTML = `
        <span class="stage-dot mt-1.5"></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span class="text-sm font-medium" data-f="title"></span>
            <span class="text-xs text-dim" data-f="date"></span>
            <span data-f="chip"></span>
          </div>
          <p class="text-xs text-mist mt-0.5" data-f="meta"></p>
          <p class="text-sm text-mist mt-0.5 break-words" data-f="note"></p>
          <button type="button" class="hidden mt-2 link text-sm font-medium" data-repair></button>
        </div>
        <button type="button" class="link-quiet px-1 py-1 shrink-0" data-del aria-label="Remove this entry">Remove</button>`;
      // Ids can come from an imported file, so set them as properties rather than interpolating into HTML.
      const repair = li.querySelector('[data-repair]');
      repair.dataset.id = l.id;
      li.querySelector('[data-del]').dataset.del = l.id;
      const f = (k) => li.querySelector(`[data-f="${k}"]`);
      const dot = li.querySelector('.stage-dot');
      const meta = [];
      const chip = f('chip');
      chip.className = 'chip';

      if (l.kind === 'act') {
        dot.style.background = VT.ACT.color;
        f('title').textContent = l.label;
        if (l.status === 'planned') {
          chip.classList.add('chip-open');
          chip.textContent = 'Up next';
        } else {
          chip.classList.add('chip-act');
          chip.textContent = l.lift != null ? `Helped ${l.lift}/5` : 'Good act';
        }
        meta.push(l.virtues.map((id) => VT.virtueById(id).name).join(', '));
        if (l.expectLift != null && l.lift != null) meta.push(`Expected ${l.expectLift}/5 → it was ${l.lift}/5`);
        if (l.linkedUrgeId) meta.push('Chosen instead of the pull');
        if (l.planId) meta.push('Kept an if-then plan');
      } else {
        const v = VT.virtueById(l.virtue);
        meta.push(v.name);
        if (l.need) meta.push(`Needed: ${VT.needById(l.need).name.toLowerCase()}`);
        if (l.kind === 'urge') {
          const st = VT.stageById(l.stage);
          dot.style.background = st.color;
          f('title').textContent = st.name;
          const chosen = allLogs.find((x) => x.linkedUrgeId === l.id);
          if (chosen) meta.push(`→ chose: ${chosen.label}`);
          chip.remove();
        } else {
          dot.style.background = VT.SLIP.color;
          f('title').textContent = v.slipLabel;
          if (v.repairs.length) {
            chip.classList.add(l.disclosed ? 'chip-win' : 'chip-open');
            chip.textContent = l.disclosed ? 'Double victory' : 'Not yet made right';
            if (!l.disclosed) {
              repair.dataset.repair = 'first';
              repair.textContent = VT.repairAction(v);
              repair.classList.remove('hidden');
            } else {
              // Patience has two repairs (kids and spouse); let the second one be recorded later too.
              const missing = v.repairs.find((t) => !l.repairs || l.repairs[t] == null);
              if (l.actual == null && l.disclosedAt > weekAgo) {
                // Told recently, but how it went was never recorded.
                repair.dataset.repair = 'outcome';
                repair.textContent = 'How did it go?';
                repair.classList.remove('hidden');
              } else if (missing) {
                repair.dataset.repair = missing;
                repair.textContent = `Also: ${VT.REPAIRS[missing].action()}`;
                repair.classList.remove('hidden');
              }
            }
          } else chip.remove();
          if (l.predicted != null && l.actual != null) meta.push(`Braced for ${l.predicted}/10 → it was ${l.actual}/10`);
          else if (l.predicted != null && !l.disclosed) meta.push(`Bracing for ${l.predicted}/10`);
        }
      }

      f('date').textContent = VT.dates.pretty(l.date, { weekday: 'short', month: 'short', day: 'numeric' });
      const metaText = meta.filter(Boolean).join(' · ');
      if (metaText) f('meta').textContent = metaText;
      else f('meta').remove();
      if (l.note) f('note').textContent = l.note;
      else f('note').remove();
      list.appendChild(li);
    });
  }

  function onRecentClick(e) {
    const repair = e.target.closest('[data-repair]');
    if (repair) {
      if (repair.dataset.repair === 'first') return openDisclose(repair.dataset.id);
      if (repair.dataset.repair === 'outcome') return openDisclose(repair.dataset.id, { outcomeOnly: true });
      const entry = VT.store.getLog(repair.dataset.id);
      if (!entry) return;
      const target = repair.dataset.repair;
      const saved = VT.store.updateLog(entry.id, { repairs: { ...entry.repairs, [target]: Date.now() } });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      render();
      return toast(target === 'kids' ? 'Repaired with the kids too. That’s what they’ll remember.' : `Told ${VT.spouse('your')} too. Nothing hidden.`);
    }
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    if (!confirm('Remove this entry?')) return;
    const id = btn.dataset.del;
    if (!VT.store.deleteLog(id)) return toast(VT.ui.SAVE_FAILED);
    // A good act chosen instead of a deleted pull still happened; just drop the link to the pull.
    VT.store.logs().filter((l) => l.linkedUrgeId === id).forEach((l) => VT.store.updateLog(l.id, { linkedUrgeId: null }));
    VT.today.forget(id);
    VT.honesty.forget(id);
    render();
    toast('Entry removed');
    prefillEnergy();
  }

  // ---------- Repair made later (from Recent) ----------
  // outcomeOnly: the slip was already made right; just record how it actually went.
  function openDisclose(id, { outcomeOnly = false } = {}) {
    const entry = VT.store.getLog(id);
    if (!entry) return;
    const v = VT.virtueById(entry.virtue);
    if (!v.repairs.length) return;
    VT.honesty.flush();
    disclosing = { id, outcomeOnly };

    $('dlg-title').textContent = outcomeOnly ? 'How did it go?' : VT.kidsFirst(v) ? 'You made it right.' : 'You told the truth.';
    const who = $('dlg-who');
    who.querySelectorAll('label').forEach((x) => x.remove());
    who.classList.toggle('hidden', outcomeOnly || v.repairs.length < 2);
    $('dlg-who-error').classList.add('hidden');
    v.repairs.forEach((t, i) => {
      const label = document.createElement('label');
      label.className = 'choice';
      label.innerHTML = `<input type="checkbox" name="dlg-repair" class="sr-only" ${i === 0 ? 'checked' : ''} />
        <span class="choice-body flex items-center gap-3"><span class="checkmark" aria-hidden="true"></span><span class="font-medium" data-f="l"></span></span>`;
      label.querySelector('input').value = t;
      label.querySelector('[data-f="l"]').textContent = VT.REPAIRS[t].action();
      who.appendChild(label);
    });

    // A prediction made before the conversation is kept as-is so hindsight can't rewrite it.
    const fixed = entry.predicted != null;
    $('dlg-predicted-fixed').classList.toggle('hidden', !fixed);
    $('dlg-predicted-row').classList.toggle('hidden', fixed);
    if (fixed) $('dlg-predicted-fixed').textContent = `Before, you braced for ${entry.predicted}/10.`;
    VT.ui.setSlider('dlg-predicted', 5);
    VT.ui.setSlider('dlg-actual', 5);
    VT.ui.openDialog($('disclose-dialog'));
  }

  function closeDisclose() {
    VT.ui.closeDialog($('disclose-dialog'));
    disclosing = null;
  }

  function onDiscloseSubmit(e) {
    e.preventDefault();
    const entry = disclosing && VT.store.getLog(disclosing.id);
    if (!entry) return closeDisclose();
    if (disclosing.outcomeOnly) {
      const saved = VT.store.updateLog(entry.id, {
        predicted: entry.predicted != null ? entry.predicted : $('dlg-predicted').value,
        actual: $('dlg-actual').value,
      });
      closeDisclose();
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      render();
      return toast('Saved. Your Fear vs. Reality graph just grew.');
    }
    const v = VT.virtueById(entry.virtue);
    const chosen = v.repairs.length > 1 ? [...document.querySelectorAll('input[name="dlg-repair"]:checked')].map((x) => x.value) : [v.repairs[0]];
    if (!chosen.length) return $('dlg-who-error').classList.remove('hidden');
    const now = Date.now();
    const repairs = { ...(entry.repairs || {}) };
    chosen.forEach((t) => {
      if (repairs[t] == null) repairs[t] = now;
    });
    const saved = VT.store.updateLog(entry.id, {
      repairs,
      disclosedAt: entry.disclosedAt || now,
      predicted: entry.predicted != null ? entry.predicted : $('dlg-predicted').value,
      actual: $('dlg-actual').value,
    });
    closeDisclose();
    if (!saved) return toast(VT.ui.SAVE_FAILED);
    render();
    const copy = VT.insights.moment('celebrate', saved);
    VT.ui.banner(copy.title, copy.extra || 'Nothing hidden. That’s the bigger win.', 6500, 'mint');
  }

  // ---------- Weekly check-in ----------
  // An installed app can stay open for days: keep the check-in on the current week unless one was picked.
  function syncWeekDate() {
    const today = VT.dates.today();
    $('week-of').max = today;
    const want = VT.dates.weekStart(today);
    if ((!weekTouched || !$('week-of').value) && $('week-of').value !== want) {
      $('week-of').value = want;
      prefillEnergy();
    }
  }

  function openWeekly(open) {
    if (open) syncWeekDate();
    $('weekly-body').classList.toggle('hidden', !open);
    $('weekly-toggle').textContent = open ? 'Later' : 'Start';
    $('weekly-toggle').setAttribute('aria-expanded', String(open));
    if (open) $('weekly-feedback').classList.add('hidden');
  }

  function buildFrictionSliders(activeIds) {
    const wrap = $('friction-list');
    // Keep values already chosen for virtues that stay listed.
    const prev = {};
    wrap.querySelectorAll('input[data-virtue]').forEach((x) => (prev[x.dataset.virtue] = x.value));
    wrap.innerHTML = '';
    activeIds.forEach((id) => {
      const v = VT.virtueById(id);
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="flex items-baseline justify-between gap-3">
          <label for="friction-${id}" class="field-label flex items-center gap-2"><span class="vdot"></span><span data-f="n"></span></label>
          <output id="friction-${id}-out" class="h-display text-xl font-semibold tabular-nums">5</output>
        </div>
        <input type="range" id="friction-${id}" min="1" max="10" step="1" value="5" class="range mt-3" data-out="friction-${id}-out" data-virtue="${id}" />`;
      div.querySelector('.vdot').style.background = v.color;
      div.querySelector('[data-f="n"]').textContent = `${v.name} · ${v.area}`;
      wrap.appendChild(div);
      if (prev[id]) VT.ui.setSlider(`friction-${id}`, prev[id]);
    });
  }

  // Pre-select "where did your energy go" from the week's actual logs; the person can override.
  // The hint always reflects the chosen week; the answer is only pre-selected until the person picks one.
  function prefillEnergy() {
    const weekOf = $('week-of').value;
    const hint = $('energy-hint');
    hint.textContent = '';
    if (!energyTouched) document.querySelectorAll('input[name="energy"]').forEach((x) => (x.checked = false));
    if (!weekOf) return;
    const end = VT.dates.addDays(weekOf, 6);
    const wk = VT.store.logs().filter((l) => l.date >= weekOf && l.date <= end);
    const acts = wk.filter(VT.isDoneAct).length;
    const fights = wk.filter((l) => l.kind === 'urge' || l.kind === 'slip').length;
    if (!acts && !fights) return;
    const counts = `From your logs that week: ${VT.plural(acts, 'good act')} · ${VT.plural(fights, 'urge or slip', 'urges or slips')}.`;
    if (energyTouched) {
      hint.textContent = counts;
      return;
    }
    const value = acts > 0 && acts >= fights ? 'initiation' : 'restriction';
    document.querySelector(`input[name="energy"][value="${value}"]`).checked = true;
    hint.textContent = `${counts} Pre-selected — change it if that’s not how it felt.`;
  }

  function resetWeeklyForm() {
    $('weekly-form').reset();
    energyTouched = false;
    weekTouched = false;
    $('week-of').value = VT.dates.weekStart(VT.dates.today());
    $('week-of').max = VT.dates.today();
    buildFrictionSliders(VT.store.settings().activeVirtues);
    $('weekly-error').classList.add('hidden');
    prefillEnergy();
  }

  function onWeeklySubmit(e) {
    e.preventDefault();
    const energy = document.querySelector('input[name="energy"]:checked');
    const compassion = $('compassion').value;
    const weekOf = $('week-of').value;
    if (weekOf > VT.dates.today()) {
      $('weekly-error').textContent = 'That week hasn’t started yet. Pick this week or an earlier one.';
      $('weekly-error').classList.remove('hidden');
      return;
    }
    if (!energy || compassion === '' || !weekOf) {
      $('weekly-error').textContent = 'Two more answers and you’re done: where your energy went, and how you met yourself.';
      $('weekly-error').classList.remove('hidden');
      return;
    }
    const frictions = {};
    $('friction-list').querySelectorAll('input[data-virtue]').forEach((x) => (frictions[x.dataset.virtue] = Number(x.value)));
    const saved = VT.store.addWeekly({ weekOf, frictions, energy: energy.value, compassion, note: $('weekly-note').value });
    if (!saved) return toast(VT.ui.SAVE_FAILED);

    const fb = VT.insights.weeklyFeedback(saved, VT.store.weeklies(), VT.store.logs(), VT.store.settings().activeVirtues);
    const body = $('weekly-feedback-body');
    body.innerHTML = '';
    fb.paragraphs.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = t;
      body.appendChild(p);
    });
    VT.ui.verse($('weekly-verse'), fb.verse);
    resetWeeklyForm();
    openWeekly(false);
    $('weekly-feedback').classList.remove('hidden');
    render();
    toast('Check-in saved');
    VT.ui.reveal($('weekly-card'), 'start');
  }

  // ---------- Settings ----------
  function renderSettings(s) {
    $('theme-seg').querySelectorAll('[data-theme-pref]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePref === s.theme)));
    const wrap = $('virtue-toggles');
    wrap.innerHTML = '';
    VT.VIRTUES.forEach((v) => wrap.appendChild(VT.ui.pill(`${v.name} · ${v.area}`, { toggleVirtue: v.id }, { pressed: s.activeVirtues.includes(v.id) })));
    // Don't overwrite a field while it's being typed in.
    if (document.activeElement !== $('set-spouse')) $('set-spouse').value = s.spouseName;
    if (document.activeElement !== $('set-kids')) $('set-kids').value = s.kidName;
  }

  function onTheme(e) {
    const b = e.target.closest('[data-theme-pref]');
    if (!b) return;
    if (!VT.store.updateSettings({ theme: b.dataset.themePref })) return toast(VT.ui.SAVE_FAILED);
    applyTheme(b.dataset.themePref);
    render();
  }

  function onVirtueToggle(e) {
    const b = e.target.closest('[data-toggle-virtue]');
    if (!b) return;
    const id = b.dataset.toggleVirtue;
    const active = VT.store.settings().activeVirtues;
    const resting = active.includes(id);
    const next = resting ? active.filter((x) => x !== id) : VT.VIRTUE_IDS.filter((x) => x === id || active.includes(x));
    if (!next.length) return toast('Keep at least one virtue active.');
    const before = VT.store.setting('lastVirtue');
    if (!VT.store.updateSettings({ activeVirtues: next })) return toast(VT.ui.SAVE_FAILED);
    const after = VT.store.settings();
    // Keep in-progress forms: only rebuild the friction sliders, and only reset the urge form if its virtue changed.
    buildFrictionSliders(after.activeVirtues);
    if (after.lastVirtue !== before) VT.today.resetUrge();
    render();
    toast(resting ? `${VT.virtueById(id).name} is resting. Its history stays.` : `${VT.virtueById(id).name} is active.`);
  }

  // One timer per field, so typing in one name doesn't cancel a pending save of the other.
  const nameTimers = {};
  function saveNameSoon(key, value) {
    clearTimeout(nameTimers[key]);
    nameTimers[key] = setTimeout(() => {
      if (!VT.store.updateSettings({ [key]: value })) return toast(VT.ui.SAVE_FAILED);
      render();
    }, 300);
  }

  // ---------- Data ----------
  function onExport() {
    const blob = new Blob([VT.store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plumb-line-${VT.dates.today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function afterDataReset() {
    VT.today.forget();
    VT.honesty.forget();
    VT.today.resetUrge();
    resetWeeklyForm();
    openWeekly(false);
    $('weekly-feedback').classList.add('hidden');
  }

  function onImport(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Importing replaces everything currently saved in this browser. Continue?')) return;
    file.text().then((text) => {
      try {
        const n = VT.store.importJSON(text);
        afterDataReset();
        applyTheme(VT.store.setting('theme'));
        render();
        toast(`Imported ${n.logs} logs and ${n.weeklies} check-ins`);
      } catch (err) {
        if (err && err.message === 'Could not save imported data') return toast(VT.ui.SAVE_FAILED);
        toast('That file couldn’t be read as Plumb Line data. Nothing was changed.');
      }
    });
  }

  function onReset() {
    if (!confirm('Permanently clear all logs and check-ins from this browser? Your virtues, good acts and plans stay. Export first if you want a backup.')) return;
    if (!VT.store.clear()) return toast(VT.ui.SAVE_FAILED);
    afterDataReset();
    render();
    toast('All logs cleared');
  }

  // ---------- Foundations ----------
  function renderAnchors(s) {
    const list = $('anchors');
    list.innerHTML = '';
    const add = (label, color, text) => {
      const li = document.createElement('li');
      li.className = 'anchor';
      li.innerHTML = '<p class="anchor-label"><span class="vdot"></span><span></span></p><p class="anchor-text"></p>';
      li.querySelector('.vdot').style.background = color;
      li.firstChild.lastChild.textContent = label;
      li.lastChild.textContent = text;
      list.appendChild(li);
    };
    s.activeVirtues.forEach((id) => {
      const v = VT.virtueById(id);
      add(v.name, v.color, v.becoming);
    });
    add('Honesty', 'var(--twilight)', `Nothing hidden from ${VT.spouse('my')}.`);
  }

  // An open section keeps its title pinned while you read, ends with a close button, and closing it
  // from anywhere brings you back to that section's title instead of leaving you further down the page.
  // On desktop the floating nav sits at the top, so pinned titles sit just below it.
  function navOffset() {
    const r = document.querySelector('.nav').getBoundingClientRect();
    if (r.top >= window.innerHeight / 2) return 0;
    const base = document.querySelector('.nav-scrim').getBoundingClientRect();
    return Math.ceil(Math.max(r.bottom + 8, base.bottom));
  }

  // Height covered by pinned title bars above a section: the desktop nav, plus an open parent section.
  function pinnedAbove(details) {
    let h = navOffset();
    const parent = details.parentElement.closest('details.foundation');
    if (parent && parent.open) h += parent.querySelector(':scope > summary').offsetHeight;
    return h;
  }

  function initReading() {
    const sync = () => document.documentElement.style.setProperty('--sticky-top', `${navOffset()}px`);
    sync();
    window.addEventListener('resize', sync);

    document.querySelectorAll('#foundations-list details.foundation, #foundations-list details.vice').forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'collapse-btn';
      btn.innerHTML = `${d.classList.contains('vice') ? 'Close' : 'Close section'} <span aria-hidden="true">&uarr;</span>`;
      btn.addEventListener('click', () => {
        d.open = false;
        // The button just disappeared; keep keyboard / VoiceOver focus on the section's title.
        d.querySelector(':scope > summary').focus({ preventScroll: true });
      });
      d.querySelector(':scope > .foundation-body, :scope > .vice-body').appendChild(btn);
    });

    // 'toggle' doesn't bubble, so listen in the capture phase.
    $('foundations-list').addEventListener(
      'toggle',
      (e) => {
        const d = e.target;
        if (d.open || !(d.classList.contains('foundation') || d.classList.contains('vice'))) return;
        const top = pinnedAbove(d);
        const rect = d.getBoundingClientRect();
        if (rect.top >= top) return;
        jumpTo(window.scrollY + rect.top - top - 8);
      },
      true
    );
  }

  // ---------- Boot ----------
  function init() {
    VT.app = { render, showTab };
    applyTheme(VT.store.setting('theme'));

    // Static scripture placements (Foundations).
    document.querySelectorAll('figure[data-verse]').forEach((el) => VT.scripture.render(el, el.dataset.verse));
    initReading();
    $('translation-note').textContent = `${VT.TRANSLATION.notice} Tap “Read in NIV” on any verse for the New International Version.`;

    VT.today.init();
    VT.honesty.init();
    resetWeeklyForm();

    document.addEventListener('input', (e) => {
      const out = e.target.dataset && e.target.dataset.out;
      if (out) $(out).textContent = e.target.value;
    });

    $('disclose-form').addEventListener('submit', onDiscloseSubmit);
    $('dlg-cancel').addEventListener('click', closeDisclose);
    $('disclose-dialog').addEventListener('close', () => (disclosing = null));

    $('journey-filter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-jv]');
      if (!b) return;
      journeyVirtue = b.dataset.jv || null;
      render();
    });
    $('theme-seg').addEventListener('click', onTheme);
    $('virtue-toggles').addEventListener('click', onVirtueToggle);
    $('set-spouse').addEventListener('input', () => saveNameSoon('spouseName', $('set-spouse').value));
    $('set-kids').addEventListener('input', () => saveNameSoon('kidName', $('set-kids').value));

    $('weekly-toggle').addEventListener('click', () => openWeekly($('weekly-body').classList.contains('hidden')));
    $('weekly-form').addEventListener('submit', onWeeklySubmit);
    $('weekly-form').addEventListener('change', (e) => {
      $('weekly-error').classList.add('hidden');
      if (e.target.name === 'energy') energyTouched = true;
      if (e.target.id === 'week-of') {
        weekTouched = true;
        prefillEnergy();
      }
    });
    $('recent-list').addEventListener('click', onRecentClick);
    $('export-btn').addEventListener('click', onExport);
    $('import-input').addEventListener('change', onImport);
    $('reset-btn').addEventListener('click', onReset);

    window.addEventListener('hashchange', () => showTab(tabFromHash()));
    document.addEventListener('click', onTabClick);
    window.addEventListener('resize', () => {
      moveIndicator(false);
      clearTimeout(init.resizeTimer);
      init.resizeTimer = setTimeout(() => drawCharts(false), 150);
    });
    // Timers are throttled in background tabs; re-sync the moment the page is visible again.
    // Going to the background (or being closed) saves anything typed but not yet stored.
    const flush = () => {
      VT.today.flush();
      VT.honesty.flush();
    };
    document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? render() : flush()));
    window.addEventListener('pagehide', flush);
    // Another tab or window saved: take its data so this one doesn't overwrite it.
    window.addEventListener('storage', (e) => {
      if (e.key !== VT.store.KEY) return;
      VT.store.reload();
      render();
    });
    // The desktop nav's base only shows once content has scrolled under it.
    const onScroll = () => document.documentElement.classList.toggle('scrolled', window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    // iOS only shows :active pressed states when a touch listener exists.
    document.addEventListener('touchstart', () => {}, { passive: true });

    showTab(tabFromHash(), { scroll: false });
    render();
    if (VT.store.takeLoadProblem()) {
      VT.ui.banner('Your saved data couldn’t be read.', 'A copy was kept on this device, untouched. New entries start fresh — export soon so nothing is lost.', 9000);
    }
    // Web fonts change the tab label widths; re-place the indicator once they're in.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveIndicator(false));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
