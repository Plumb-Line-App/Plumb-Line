// UI controller: wires forms to the store and re-renders the dashboard after every change.
(function () {
  const $ = (id) => document.getElementById(id);
  const RECENT_LIMIT = 8;
  const CLOSED_BANNER_MS = 24 * 60 * 60 * 1000; // a closed window stays visible for a day unless dismissed
  const BASE_TITLE = document.title;
  const SAVE_FAILED = 'This didn’t save — browser storage may be full or blocked. What you wrote still matters; try Export to keep a copy.';

  let celebration = null; // transient: the entry we're celebrating, until closed
  let ticker = null;
  let disclosingId = null;
  let scriptVariant = 0;

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---------- Stage options ----------
  function renderStageOptions() {
    const wrap = $('stage-options');
    wrap.innerHTML = '';
    VT.STAGES.forEach((s) => {
      const label = document.createElement('label');
      label.className = 'choice';
      label.innerHTML = `
        <input type="radio" name="stage" value="${s.id}" class="sr-only" />
        <span class="choice-body">
          <span class="flex items-center gap-2">
            <span class="stage-dot" style="background:${s.color}"></span>
            <span class="text-xs text-stone-500">Stage ${s.id}</span>
          </span>
          <span class="block font-medium text-stone-800 mt-1"></span>
          <span class="hidden sm:block text-xs text-stone-500 mt-1 leading-snug"></span>
        </span>`;
      const [name, desc] = label.querySelectorAll('.choice-body > span:not(.flex)');
      name.textContent = s.name;
      desc.textContent = s.desc;
      wrap.appendChild(label);
    });
  }

  // ---------- Tabs ----------
  const TABS = ['today', 'honesty', 'journey', 'weekly', 'why'];

  function showTab(name, { scroll = true } = {}) {
    if (!TABS.includes(name)) name = 'today';
    document.body.dataset.tab = name;
    document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
    document.querySelectorAll('[data-tab-link]').forEach((a) => {
      const on = a.dataset.tabLink === name;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (scroll) window.scrollTo(0, 0);
    // Charts were laid out while hidden; size them now that they're visible.
    if (name === 'journey' || name === 'honesty') requestAnimationFrame(() => VT.charts.resize());
  }

  const tabFromHash = () => location.hash.replace('#', '');

  function onTabClick(e) {
    const link = e.target.closest('[data-tab-link]');
    // Tapping the tab you're already on scrolls back to the top, like a native tab bar.
    if (link && link.dataset.tabLink === document.body.dataset.tab) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function renderSnapshot(s, h, due) {
    $('snap-phase').textContent = s.phase;
    $('snap-marker').style.left = `${s.score == null ? 0 : Math.max(2, Math.min(98, s.score))}%`;
    $('snap-marker').style.opacity = s.score == null ? '0.35' : '1';
    const bits = [`${s.count30} log${s.count30 === 1 ? '' : 's'} in 30 days`];
    if (h.slips30) bits.push(`${h.shared30} of ${h.slips30} slips shared`);
    if (due == null) bits.push('First weekly check-in whenever you\u2019re ready');
    else if (due <= 0) bits.push('Weekly check-in ready');
    $('snap-meta').textContent = bits.join(' \u00b7 ');
  }

  // A quiet dot on the Honesty tab while a window is open or a slip is still unshared.
  function renderBadge(h) {
    const now = Date.now();
    const pending = VT.store.logs().some((l) => l.kind === 'slip' && !l.disclosed && l.windowEndsAt && now < l.windowEndsAt);
    $('honesty-badge').classList.toggle('hidden', !(pending || h.unshared > 0));
  }

  // ---------- Spouse wording ----------
  function renderSpouse() {
    document.querySelectorAll('[data-spouse]').forEach((el) => (el.textContent = VT.spouse(el.dataset.spouse)));
  }

  // ---------- Dashboard render ----------
  function render() {
    const logs = VT.store.logs();
    const weeklies = VT.store.weeklies();
    const s = VT.insights.summary(logs, weeklies);

    $('insight-phase').textContent = s.phase;
    $('insight-message').textContent = s.message;
    $('phase-marker').style.left = `${s.score == null ? 0 : Math.max(2, Math.min(98, s.score))}%`;
    $('phase-marker').style.opacity = s.score == null ? '0.35' : '1';

    $('stat-count').textContent = s.count30;
    $('stat-avg').textContent = s.avgStage == null ? '—' : (Math.round(s.avgStage * 10) / 10).toFixed(1);
    $('stat-friction').textContent = s.latestFriction == null ? '—' : s.latestFriction;

    const h = VT.insights.honesty(logs);
    $('honesty-message').textContent = h.message;
    $('stat-slips').textContent = h.slips30;
    $('stat-shared').textContent = h.slips30 ? `${h.shared30}/${h.slips30}` : '0';
    $('stat-streak').textContent = h.streak;
    $('fear-summary').textContent = h.fear;

    VT.charts.update(weeklies, s.counts);
    VT.charts.updateFear(h.pairs);
    renderRecent(logs);
    renderDue(weeklies);
    renderSnapshot(s, h, VT.insights.checkInDue(weeklies));
    renderBadge(h);
    renderSpouse();
    renderMoment();
  }

  function renderRecent(logs) {
    const list = $('recent-list');
    list.innerHTML = '';
    const recent = [...logs].reverse().slice(0, RECENT_LIMIT);
    $('recent-empty').classList.toggle('hidden', recent.length > 0);
    $('recent-count').textContent = logs.length ? `${logs.length} total` : '';

    recent.forEach((l) => {
      const isSlip = l.kind === 'slip';
      const meta = isSlip ? VT.SLIP : VT.stageById(l.stage);
      const li = document.createElement('li');
      li.className = 'py-3 flex gap-3 items-start group';
      li.innerHTML = `
        <span class="stage-dot mt-1.5" style="background:${meta.color}"></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span class="text-sm font-medium text-stone-800" data-f="stage"></span>
            <span class="text-xs text-stone-500" data-f="date"></span>
            <span data-f="chip"></span>
          </div>
          <p class="text-sm text-stone-600 mt-0.5 break-words" data-f="note"></p>
          <p class="text-xs text-stone-500 mt-1" data-f="fear"></p>
          <button type="button" class="hidden mt-2 text-sm text-sage-700 font-medium hover:underline" data-told="${l.id}"></button>
        </div>
        <button type="button" class="text-xs text-stone-400 hover:text-stone-700 px-2 py-1 rounded sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" data-del="${l.id}" aria-label="Delete this entry">Remove</button>`;
      li.querySelector('[data-f="stage"]').textContent = meta.name;
      li.querySelector('[data-f="date"]').textContent = VT.dates.pretty(l.date, { weekday: 'short', month: 'short', day: 'numeric' });

      const chip = li.querySelector('[data-f="chip"]');
      if (isSlip) {
        chip.className = `chip ${l.disclosed ? 'chip-win' : 'chip-open'}`;
        chip.textContent = l.disclosed ? 'Double victory' : 'Not yet shared';
      } else chip.remove();

      const note = li.querySelector('[data-f="note"]');
      if (l.note) note.textContent = l.note;
      else note.remove();

      const fear = li.querySelector('[data-f="fear"]');
      if (isSlip && l.predicted != null && l.actual != null) fear.textContent = `Braced for ${l.predicted}/10 → it was ${l.actual}/10`;
      else if (isSlip && l.predicted != null && !l.disclosed) fear.textContent = `Bracing for ${l.predicted}/10`;
      else fear.remove();

      const told = li.querySelector('[data-told]');
      if (isSlip && !l.disclosed) {
        told.textContent = `I told ${VT.spouse('my')}`;
        told.classList.remove('hidden');
      } else told.remove();

      list.appendChild(li);
    });
  }

  function renderDue(weeklies) {
    const due = VT.insights.checkInDue(weeklies);
    const el = $('weekly-due');
    if (due == null) el.textContent = 'First check-in';
    else if (due > 1) el.textContent = `Next one in ${due} days`;
    else if (due === 1) el.textContent = 'Next one tomorrow';
    else el.textContent = 'Ready when you are';
  }

  // ---------- Moment banner (honesty window / celebration) ----------
  // The banner follows the most recent undisclosed, undismissed slip that still has a window.
  function currentWindowEntry(now = Date.now()) {
    return (
      VT.store
        .logs()
        .filter((l) => l.kind === 'slip' && !l.disclosed && !l.windowDismissed && l.windowEndsAt && now < l.windowEndsAt + CLOSED_BANNER_MS)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null
    );
  }

  const fmt = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  function renderMoment() {
    const el = $('moment');
    const now = Date.now();
    let state = null;
    let entry = null;

    if (celebration) {
      state = 'celebrate';
      entry = celebration;
    } else {
      entry = currentWindowEntry(now);
      if (entry) state = now < entry.windowEndsAt ? 'running' : 'closed';
    }

    if (!state) {
      el.classList.add('hidden');
      stopTicker();
      return;
    }

    const copy = VT.insights.moment(state, entry);
    el.dataset.state = state;
    el.dataset.entry = entry.id;
    el.classList.remove('hidden');
    $('moment-eyebrow').textContent = copy.eyebrow;
    $('moment-title').textContent = copy.title;
    $('moment-body').textContent = copy.body;
    $('moment-extra').textContent = copy.extra;
    $('moment-extra').classList.toggle('hidden', !copy.extra);

    const running = state === 'running';
    $('moment-timer').classList.toggle('hidden', !running);
    $('moment-bar-wrap').classList.toggle('hidden', !running);
    $('moment-told').classList.toggle('hidden', state === 'celebrate');
    $('moment-told').textContent = `I told ${VT.spouse('my')}`;
    $('moment-script').classList.toggle('hidden', state === 'celebrate');
    $('moment-dismiss').textContent = state === 'celebrate' ? 'Close' : 'Not right now';
    $('moment-dismiss').classList.toggle('hidden', running);

    if (running) {
      tick();
      startTicker();
    } else {
      stopTicker();
    }
  }

  function tick() {
    const el = $('moment');
    if (el.dataset.state !== 'running') return stopTicker();
    const entry = VT.store.getLog(el.dataset.entry);
    if (!entry) return renderMoment();
    const left = entry.windowEndsAt - Date.now();
    if (left <= 0) {
      document.title = BASE_TITLE;
      return render(); // flips the banner to the "door didn't close" state and refreshes honesty stats
    }
    $('moment-timer').textContent = fmt(left);
    $('moment-bar').style.width = `${(left / VT.HONESTY_WINDOW_MS) * 100}%`;
    document.title = `${fmt(left)} · Honesty window`;
  }

  function startTicker() {
    if (!ticker) ticker = setInterval(tick, 1000);
  }
  function stopTicker() {
    clearInterval(ticker);
    ticker = null;
    document.title = BASE_TITLE;
  }

  function onMomentDismiss() {
    const el = $('moment');
    if (el.dataset.state === 'celebrate') {
      celebration = null;
    } else {
      VT.store.updateLog(el.dataset.entry, { windowDismissed: true });
      toast('Okay. The option to share stays open in Recent reflections.');
    }
    renderMoment();
  }

  // ---------- Disclosure dialog ----------
  function openDisclose(id) {
    const entry = VT.store.getLog(id);
    if (!entry) return;
    disclosingId = id;
    const fixed = entry.predicted != null;
    // A prediction made before the conversation is kept as-is so hindsight can't rewrite it.
    $('dlg-predicted-fixed').classList.toggle('hidden', !fixed);
    $('dlg-predicted-row').classList.toggle('hidden', fixed);
    if (fixed) $('dlg-predicted-fixed').textContent = `Before you told ${VT.spouse('them')}, you braced for ${entry.predicted}/10.`;
    setSlider('dlg-predicted', 5);
    setSlider('dlg-actual', 5);
    const dlg = $('disclose-dialog');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function closeDisclose() {
    const dlg = $('disclose-dialog');
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
    disclosingId = null;
  }

  function onDiscloseSubmit(e) {
    e.preventDefault();
    const entry = VT.store.getLog(disclosingId);
    if (!entry) return closeDisclose();
    const saved = VT.store.updateLog(entry.id, {
      disclosed: true,
      disclosedAt: Date.now(),
      predicted: entry.predicted != null ? entry.predicted : $('dlg-predicted').value,
      actual: $('dlg-actual').value,
    });
    closeDisclose();
    if (!saved) return toast(SAVE_FAILED);
    celebrate(saved);
  }

  function celebrate(entry) {
    celebration = entry;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Daily log ----------
  function currentKind() {
    return document.querySelector('input[name="kind"]:checked').value;
  }

  function syncLogForm() {
    const slip = currentKind() === 'slip';
    const disclosed = $('slip-disclosed').checked;
    $('urge-fields').classList.toggle('hidden', slip);
    $('slip-fields').classList.toggle('hidden', !slip);
    $('slip-actual-row').classList.toggle('hidden', !disclosed);
    $('slip-window-note').classList.toggle('hidden', disclosed);
    $('slip-predicted-label').innerHTML = disclosed
      ? 'Before you told <span data-spouse="them"></span>, how hard did you expect it to go?'
      : 'Before you tell <span data-spouse="them"></span>: how hard do you expect it to go?';
    $('log-note').placeholder = slip
      ? 'What was going on? e.g. Rough afternoon, ate standing at the counter. Not proud of it, but writing it down.'
      : 'e.g. Felt down after work, paused for 10 minutes instead of opening the pantry.';
    renderSpouse();
  }

  function resetLogForm() {
    $('log-form').reset();
    $('log-date').value = VT.dates.today();
    $('stage-error').classList.add('hidden');
    $('stage-desc').textContent = 'Tap the stage that fits best.';
    setSlider('slip-predicted', 5);
    setSlider('slip-actual', 5);
    syncLogForm();
  }

  function onLogSubmit(e) {
    e.preventDefault();
    const date = $('log-date').value || VT.dates.today();
    const note = $('log-note').value;

    if (currentKind() === 'slip') {
      const disclosed = $('slip-disclosed').checked;
      const saved = VT.store.addLog({
        date,
        kind: 'slip',
        note,
        disclosed,
        predicted: $('slip-predicted').value,
        actual: $('slip-actual').value,
      });
      if (!saved) return toast(SAVE_FAILED);
      resetLogForm();
      if (disclosed) {
        celebrate(saved);
      } else {
        celebration = null;
        render();
        toast('Logged. You’re not in trouble, and you’re not alone.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const picked = document.querySelector('input[name="stage"]:checked');
    if (!picked) {
      $('stage-error').classList.remove('hidden');
      document.querySelector('input[name="stage"]').focus();
      return;
    }
    const saved = VT.store.addLog({ date, kind: 'urge', stage: picked.value, note });
    if (!saved) return toast(SAVE_FAILED);
    resetLogForm();
    render();
    toast(`Logged · ${VT.stageById(saved.stage).name}`);
  }

  function onRecentClick(e) {
    const told = e.target.closest('[data-told]');
    if (told) return openDisclose(told.dataset.told);
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    if (!confirm('Remove this reflection?')) return;
    VT.store.deleteLog(btn.dataset.del);
    if (celebration && celebration.id === btn.dataset.del) celebration = null;
    render();
    toast('Entry removed');
  }

  // ---------- Disclosure script ----------
  function scriptInputs() {
    return {
      name: $('spouse-name').value,
      what: $('script-what').value,
      whatCustom: $('script-what-custom').value,
      feeling: $('script-feeling').value,
      need: $('script-need').value,
    };
  }

  function renderScript() {
    $('script-what-custom').classList.toggle('hidden', $('script-what').value !== 'custom');
    $('script-output').value = VT.script.build(scriptInputs(), scriptVariant);
  }

  async function copyScript() {
    const text = $('script-output').value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for file:// or older browsers.
      $('script-output').select();
      document.execCommand('copy');
    }
    toast('Copied. Send it before the doubt talks you out of it.');
  }

  async function shareScript() {
    try {
      await navigator.share({ text: $('script-output').value });
    } catch (err) {
      /* user closed the share sheet */
    }
  }

  let nameTimer;
  function onSpouseName() {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => {
      VT.store.setSpouseName($('spouse-name').value);
      renderSpouse();
      render();
    }, 300);
    renderScript();
  }

  // ---------- Weekly check-in ----------
  function resetWeeklyForm() {
    $('weekly-form').reset();
    $('week-of').value = VT.dates.weekStart(VT.dates.today());
    setSlider('friction', 5);
    $('weekly-error').classList.add('hidden');
  }

  function onWeeklySubmit(e) {
    e.preventDefault();
    const energy = document.querySelector('input[name="energy"]:checked');
    const compassion = $('compassion').value;
    const weekOf = $('week-of').value;
    if (!energy || compassion === '' || !weekOf) {
      $('weekly-error').classList.remove('hidden');
      return;
    }
    const saved = VT.store.addWeekly({
      weekOf,
      friction: $('friction').value,
      energy: energy.value,
      compassion,
      note: $('weekly-note').value,
    });
    if (!saved) return toast(SAVE_FAILED);

    const paragraphs = VT.insights.weeklyFeedback(saved, VT.store.weeklies(), VT.store.logs());
    const body = $('weekly-feedback-body');
    body.innerHTML = '';
    paragraphs.forEach((t) => {
      const p = document.createElement('p');
      p.textContent = t;
      body.appendChild(p);
    });
    $('weekly-feedback').classList.remove('hidden');

    resetWeeklyForm();
    render();
    toast('Check-in saved');
    $('weekly-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- Sliders ----------
  function setSlider(id, value) {
    const el = $(id);
    el.value = value;
    if (el.dataset.out) $(el.dataset.out).textContent = el.value;
  }

  // ---------- Data controls ----------
  function onExport() {
    const blob = new Blob([VT.store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `virtue-tracker-${VT.dates.today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function onImport(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Importing replaces everything currently saved in this browser. Continue?')) return;
    file.text().then((text) => {
      try {
        const n = VT.store.importJSON(text);
        celebration = null;
        $('spouse-name').value = VT.store.settings().spouseName;
        renderScript();
        render();
        toast(`Imported ${n.logs} logs and ${n.weeklies} check-ins`);
      } catch (err) {
        toast('That file couldn’t be read as Virtue Tracker data. Nothing was changed.');
      }
    });
  }

  function onReset() {
    if (!confirm('Permanently clear all logs and check-ins from this browser? Export first if you want a backup.')) return;
    VT.store.clear();
    celebration = null;
    $('weekly-feedback').classList.add('hidden');
    render();
    toast('All data cleared');
  }

  // ---------- Boot ----------
  function init() {
    renderStageOptions();
    resetLogForm();
    resetWeeklyForm();
    $('log-date').max = VT.dates.today();
    $('spouse-name').value = VT.store.settings().spouseName;
    if (navigator.share) $('script-share').classList.remove('hidden');
    renderScript();

    document.addEventListener('input', (e) => {
      const out = e.target.dataset && e.target.dataset.out;
      if (out) $(out).textContent = e.target.value;
    });

    $('log-form').addEventListener('submit', onLogSubmit);
    $('log-form').addEventListener('change', (e) => {
      if (e.target.name === 'kind' || e.target.id === 'slip-disclosed') syncLogForm();
      if (e.target.name === 'stage') {
        $('stage-error').classList.add('hidden');
        $('stage-desc').textContent = VT.stageById(e.target.value).desc;
      }
    });

    $('moment-told').addEventListener('click', () => openDisclose($('moment').dataset.entry));
    $('moment-dismiss').addEventListener('click', onMomentDismiss);
    $('disclose-form').addEventListener('submit', onDiscloseSubmit);
    $('dlg-cancel').addEventListener('click', closeDisclose);
    $('disclose-dialog').addEventListener('cancel', () => (disclosingId = null));

    $('spouse-name').addEventListener('input', onSpouseName);
    ['script-what', 'script-feeling', 'script-need'].forEach((id) => $(id).addEventListener('change', renderScript));
    $('script-what-custom').addEventListener('input', renderScript);
    $('script-copy').addEventListener('click', copyScript);
    $('script-share').addEventListener('click', shareScript);
    $('script-next').addEventListener('click', () => {
      scriptVariant = (scriptVariant + 1) % VT.script.count;
      renderScript();
    });

    $('weekly-form').addEventListener('submit', onWeeklySubmit);
    $('weekly-form').addEventListener('change', () => $('weekly-error').classList.add('hidden'));
    $('recent-list').addEventListener('click', onRecentClick);
    $('export-btn').addEventListener('click', onExport);
    $('import-input').addEventListener('change', onImport);
    $('reset-btn').addEventListener('click', onReset);

    // Timers are throttled in background tabs; re-sync the moment the page is visible again.
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && render());

    window.addEventListener('hashchange', () => showTab(tabFromHash()));
    document.addEventListener('click', onTabClick);

    VT.charts.init();
    showTab(tabFromHash(), { scroll: false });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
