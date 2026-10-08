// UI controller: wires forms to the store and re-renders the dashboard after every change.
(function () {
  const $ = (id) => document.getElementById(id);
  const RECENT_LIMIT = 8;

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
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
          <span class="block text-xs text-stone-500 mt-1 leading-snug"></span>
        </span>`;
      const [name, desc] = label.querySelectorAll('.choice-body > span.block');
      name.textContent = s.name;
      desc.textContent = s.desc;
      wrap.appendChild(label);
    });
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

    VT.charts.update(weeklies, s.counts);
    renderRecent(logs);
    renderDue(weeklies);
  }

  function renderRecent(logs) {
    const list = $('recent-list');
    list.innerHTML = '';
    const recent = [...logs].reverse().slice(0, RECENT_LIMIT);
    $('recent-empty').classList.toggle('hidden', recent.length > 0);
    $('recent-count').textContent = logs.length ? `${logs.length} total` : '';

    recent.forEach((l) => {
      const stage = VT.stageById(l.stage);
      const li = document.createElement('li');
      li.className = 'py-3 flex gap-3 items-start group';
      li.innerHTML = `
        <span class="stage-dot mt-1.5" style="background:${stage.color}"></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2">
            <span class="text-sm font-medium text-stone-800" data-f="stage"></span>
            <span class="text-xs text-stone-500" data-f="date"></span>
          </div>
          <p class="text-sm text-stone-600 mt-0.5 break-words" data-f="note"></p>
        </div>
        <button type="button" class="text-xs text-stone-400 hover:text-stone-700 px-2 py-1 rounded sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" data-del="${l.id}" aria-label="Delete this entry">Remove</button>`;
      li.querySelector('[data-f="stage"]').textContent = stage.name;
      li.querySelector('[data-f="date"]').textContent = VT.dates.pretty(l.date, { weekday: 'short', month: 'short', day: 'numeric' });
      const note = li.querySelector('[data-f="note"]');
      if (l.note) note.textContent = l.note;
      else note.remove();
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

  // ---------- Daily log ----------
  function resetLogForm() {
    $('log-form').reset();
    $('log-date').value = VT.dates.today();
    $('stage-error').classList.add('hidden');
  }

  function onLogSubmit(e) {
    e.preventDefault();
    const picked = document.querySelector('input[name="stage"]:checked');
    if (!picked) {
      $('stage-error').classList.remove('hidden');
      document.querySelector('input[name="stage"]').focus();
      return;
    }
    const date = $('log-date').value || VT.dates.today();
    const saved = VT.store.addLog({ date, stage: picked.value, note: $('log-note').value });
    if (!saved) return toast('Couldn’t save — browser storage may be full or disabled.');

    resetLogForm();
    render();
    toast(`Logged · ${VT.stageById(saved.stage).name}`);
  }

  function onRecentClick(e) {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    if (!confirm('Remove this reflection?')) return;
    VT.store.deleteLog(btn.dataset.del);
    render();
    toast('Entry removed');
  }

  // ---------- Weekly check-in ----------
  function resetWeeklyForm() {
    $('weekly-form').reset();
    $('week-of').value = VT.dates.weekStart(VT.dates.today());
    $('friction-out').textContent = $('friction').value;
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
    if (!saved) return toast('Couldn’t save — browser storage may be full or disabled.');

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
        render();
        toast(`Imported ${n.logs} logs and ${n.weeklies} check-ins`);
      } catch (err) {
        toast('That file couldn’t be read as Virtue Tracker data.');
      }
    });
  }

  function onReset() {
    if (!confirm('Permanently clear all logs and check-ins from this browser? Export first if you want a backup.')) return;
    VT.store.clear();
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

    $('log-form').addEventListener('submit', onLogSubmit);
    $('stage-options').addEventListener('change', () => $('stage-error').classList.add('hidden'));
    $('weekly-form').addEventListener('submit', onWeeklySubmit);
    $('weekly-form').addEventListener('change', () => $('weekly-error').classList.add('hidden'));
    $('friction').addEventListener('input', (e) => ($('friction-out').textContent = e.target.value));
    $('recent-list').addEventListener('click', onRecentClick);
    $('export-btn').addEventListener('click', onExport);
    $('import-input').addEventListener('change', onImport);
    $('reset-btn').addEventListener('click', onReset);

    VT.charts.init();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
