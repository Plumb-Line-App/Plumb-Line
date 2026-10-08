// App controller: tabs, the moment banner, repair dialog, script, Journey, Weekly, settings and data.
(function () {
  const { $, toast } = VT.ui;
  const RECENT_LIMIT = 10;
  const CLOSED_BANNER_MS = 24 * 60 * 60 * 1000; // a closed window stays visible for a day unless dismissed
  const BASE_TITLE = document.title;

  let moment = null; // transient banner: { state: 'celebrate' | 'grace', entry }
  let ticker = null;
  let disclosingId = null;
  let scriptVariant = 0;
  let journeyVirtue = null; // null = all
  let energyTouched = false; // once the person picks an energy answer, stop pre-filling it

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
    if (name === 'weekly') prefillEnergy();
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

  // ---------- Render ----------
  function render() {
    const logs = VT.store.logs();
    const weeklies = VT.store.weeklies();
    const s = VT.store.settings();
    if (journeyVirtue && !s.activeVirtues.includes(journeyVirtue)) journeyVirtue = null;

    const overall = VT.insights.summary(logs, weeklies, null, s.activeVirtues);
    const h = VT.insights.honesty(logs);
    const due = VT.insights.checkInDue(weeklies);

    VT.today.render({ logs, weeklies, settings: s, overall, honesty: h, due });
    renderJourney(logs, weeklies, s, overall);
    renderHonesty(h);
    renderDue(due);
    renderSettings(s);
    $('honesty-badge').classList.toggle('hidden', !(h.pending || h.unshared > 0));
    renderMoment(logs);
  }

  function renderHonesty(h) {
    $('honesty-message').textContent = h.message;
    $('stat-slips').textContent = h.slips30;
    $('stat-shared').textContent = h.slips30 ? `${h.shared30}/${h.slips30}` : '0';
    $('stat-streak').textContent = h.streak;
    $('fear-summary').textContent = h.fear;
    VT.charts.updateFear(h.pairs);
  }

  function renderDue(due) {
    const el = $('weekly-due');
    if (due == null) el.textContent = 'First check-in';
    else if (due > 1) el.textContent = `Next one in ${due} days`;
    else if (due === 1) el.textContent = 'Next one tomorrow';
    else el.textContent = 'Ready when you are';
  }

  // ---------- Journey ----------
  function renderJourney(logs, weeklies, s, overall) {
    const filter = $('journey-filter');
    filter.innerHTML = '';
    filter.appendChild(VT.ui.pill('All virtues', { jv: '' }, { pressed: !journeyVirtue }));
    s.activeVirtues.forEach((id) => {
      const v = VT.virtueById(id);
      const b = VT.ui.pill(v.name, { jv: id }, { pressed: journeyVirtue === id });
      const dot = document.createElement('span');
      dot.className = 'vdot';
      dot.style.background = v.color;
      b.prepend(dot);
      filter.appendChild(b);
    });

    const sum = journeyVirtue ? VT.insights.summary(logs, weeklies, journeyVirtue, s.activeVirtues) : overall;
    const v = journeyVirtue ? VT.virtueById(journeyVirtue) : null;
    $('insight-eyebrow').textContent = v ? `${v.name} · ${v.area}` : 'All virtues';
    $('insight-phase').textContent = sum.phase;
    $('insight-message').textContent = sum.message;
    $('phase-marker').style.left = `${VT.ui.clampPct(sum.score)}%`;
    $('phase-marker').style.opacity = sum.score == null ? '0.35' : '1';

    const paths = $('insight-paths');
    paths.innerHTML = '';
    paths.classList.toggle('hidden', !!journeyVirtue);
    sum.perVirtue.forEach((p) => {
      const vv = VT.virtueById(p.id);
      const li = document.createElement('li');
      li.className = 'flex items-center gap-2';
      li.innerHTML = '<span class="vdot"></span><span class="font-medium text-stone-800" data-f="n"></span><span class="text-stone-500" data-f="p"></span>';
      li.querySelector('.vdot').style.background = vv.color;
      li.querySelector('[data-f="n"]').textContent = vv.name;
      li.querySelector('[data-f="p"]').textContent = `· ${p.phase}`;
      paths.appendChild(li);
    });

    $('stat-acts').textContent = sum.acts30;
    $('stat-urges').textContent = sum.urges30;
    $('stat-avg').textContent = sum.avgStage == null ? '—' : sum.avgStage.toFixed(1);
    $('stat-friction').textContent = sum.latestFriction == null ? '—' : sum.latestFriction;

    // "All virtues" means the active ones; a resting virtue's history stays out of the totals.
    const scoped = journeyVirtue ? logs : VT.insights.activeScope(logs, s.activeVirtues);
    const a = VT.insights.acts(scoped, s, journeyVirtue);
    VT.charts.updateCrowd(a.weeks);
    VT.charts.updateFriction(weeklies, journeyVirtue ? [journeyVirtue] : s.activeVirtues);
    VT.charts.updateStages(sum.counts);
    renderHelps(a);
    renderRecent(logs.filter((l) => VT.inVirtue(l, journeyVirtue)), logs);
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
    const recent = [...logs].reverse().slice(0, RECENT_LIMIT);
    $('recent-empty').classList.toggle('hidden', recent.length > 0);
    $('recent-count').textContent = logs.length ? `${logs.length} total` : '';

    recent.forEach((l) => {
      const li = document.createElement('li');
      li.className = 'py-3 flex gap-3 items-start group';
      li.innerHTML = `
        <span class="stage-dot mt-1.5"></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span class="text-sm font-medium text-stone-800" data-f="title"></span>
            <span class="text-xs text-stone-500" data-f="date"></span>
            <span data-f="chip"></span>
          </div>
          <p class="text-xs text-stone-500 mt-0.5" data-f="meta"></p>
          <p class="text-sm text-stone-600 mt-0.5 break-words" data-f="note"></p>
          <button type="button" class="hidden mt-2 text-sm text-sage-700 font-medium hover:underline" data-told></button>
        </div>
        <button type="button" class="text-xs text-stone-400 hover:text-stone-700 px-2 py-1 rounded sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" data-del aria-label="Delete this entry">Remove</button>`;
      // Ids can come from an imported file, so set them as properties rather than interpolating into HTML.
      li.querySelector('[data-told]').dataset.told = l.id;
      li.querySelector('[data-del]').dataset.del = l.id;
      const f = (k) => li.querySelector(`[data-f="${k}"]`);
      const meta = [];
      const chip = f('chip');
      chip.className = 'chip';

      if (l.kind === 'act') {
        li.querySelector('.stage-dot').style.background = VT.ACT.color;
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
          li.querySelector('.stage-dot').style.background = st.color;
          f('title').textContent = st.name;
          const chosen = allLogs.find((x) => x.linkedUrgeId === l.id);
          if (chosen) meta.push(`→ chose: ${chosen.label}`);
          chip.remove();
        } else {
          li.querySelector('.stage-dot').style.background = VT.SLIP.color;
          f('title').textContent = v.slipLabel;
          if (v.repairs.length) {
            chip.classList.add(l.disclosed ? 'chip-win' : 'chip-open');
            chip.textContent = l.disclosed ? 'Double victory' : 'Not yet made right';
            const told = li.querySelector('[data-told]');
            if (!l.disclosed) {
              told.textContent = VT.repairAction(v);
              told.classList.remove('hidden');
            } else {
              // Patience has two repairs (kids and spouse); let the second one be recorded later too.
              const missing = v.repairs.find((t) => !l.repairs || l.repairs[t] == null);
              if (missing) {
                told.removeAttribute('data-told');
                told.dataset.also = missing;
                told.dataset.id = l.id;
                told.textContent = `Also: ${VT.REPAIRS[missing].action()}`;
                told.classList.remove('hidden');
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
    const told = e.target.closest('[data-told]');
    if (told) return openDisclose(told.dataset.told);
    const also = e.target.closest('[data-also]');
    if (also) {
      const entry = VT.store.getLog(also.dataset.id);
      if (!entry) return;
      const saved = VT.store.updateLog(entry.id, { repairs: { ...entry.repairs, [also.dataset.also]: Date.now() } });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      render();
      return toast(also.dataset.also === 'kids' ? 'Repaired with the kids too. That\u2019s what they\u2019ll remember.' : `Told ${VT.spouse('your')} too. Nothing hidden.`);
    }
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    if (!confirm('Remove this reflection?')) return;
    if (!VT.store.deleteLog(btn.dataset.del)) return toast(VT.ui.SAVE_FAILED);
    // A good act chosen instead of a deleted pull still happened; just drop the link to the pull.
    VT.store.logs().filter((l) => l.linkedUrgeId === btn.dataset.del).forEach((l) => VT.store.updateLog(l.id, { linkedUrgeId: null }));
    VT.today.forget(btn.dataset.del);
    if (moment && moment.entry.id === btn.dataset.del) moment = null;
    render();
    toast('Entry removed');
  }

  // ---------- Moment banner ----------
  // The banner follows the most recent un-repaired, undismissed slip that still has a window.
  function currentWindowEntry(logs, now = Date.now()) {
    return (
      logs
        .filter((l) => l.kind === 'slip' && !l.disclosed && !l.windowDismissed && l.windowEndsAt && now < l.windowEndsAt + CLOSED_BANNER_MS)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null
    );
  }

  const fmt = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  function renderMoment(logs) {
    const el = $('moment');
    const now = Date.now();
    let state = null;
    let entry = null;

    if (moment) {
      state = moment.state;
      entry = moment.entry;
    } else {
      entry = currentWindowEntry(logs, now);
      if (entry) state = now < entry.windowEndsAt ? 'running' : 'closed';
    }

    if (!state) {
      el.classList.add('hidden');
      stopTicker();
      return;
    }

    const v = VT.virtueById(entry.virtue);
    const copy = VT.insights.moment(state, entry);
    const open = state === 'running' || state === 'closed';
    el.dataset.state = state;
    el.dataset.entry = entry.id;
    el.classList.remove('hidden');
    $('moment-eyebrow').textContent = copy.eyebrow;
    $('moment-title').textContent = copy.title;
    $('moment-body').textContent = copy.body;
    $('moment-extra').textContent = copy.extra;
    $('moment-extra').classList.toggle('hidden', !copy.extra);
    VT.ui.verse($('moment-verse'), copy.verse);

    $('moment-timer').classList.toggle('hidden', state !== 'running');
    $('moment-bar-wrap').classList.toggle('hidden', state !== 'running');
    $('moment-told').classList.toggle('hidden', !open);
    if (open) $('moment-told').textContent = VT.repairAction(v);
    $('moment-script').classList.toggle('hidden', !open);
    $('moment-dismiss').textContent = open ? 'Not right now' : 'Close';
    $('moment-dismiss').classList.toggle('hidden', state === 'running');

    if (state === 'running') {
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
    if (!entry || entry.disclosed) return render();
    const left = entry.windowEndsAt - Date.now();
    if (left <= 0) {
      document.title = BASE_TITLE;
      return render(); // flips the banner to the closed state and refreshes honesty stats
    }
    $('moment-timer').textContent = fmt(left);
    $('moment-bar').style.width = `${(left / VT.HONESTY_WINDOW_MS) * 100}%`;
    document.title = `${fmt(left)} · ${VT.kidsFirst(VT.virtueById(entry.virtue)) ? 'Repair' : 'Honesty'} window`;
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
    if (moment) {
      moment = null;
    } else {
      if (!VT.store.updateLog($('moment').dataset.entry, { windowDismissed: true })) return toast(VT.ui.SAVE_FAILED);
      toast('Okay. The option to make it right stays open in Recent reflections.');
    }
    render();
  }

  function onMomentScript() {
    // Open the script ready for whoever this slip is about.
    const entry = VT.store.getLog($('moment').dataset.entry);
    if (entry) setScriptTo(VT.kidsFirst(VT.virtueById(entry.virtue)) ? 'kids' : 'spouse');
  }

  // ---------- Repair dialog ----------
  function openDisclose(id) {
    const entry = VT.store.getLog(id);
    if (!entry) return;
    const v = VT.virtueById(entry.virtue);
    if (!v.repairs.length) return;
    disclosingId = id;

    $('dlg-title').textContent = VT.kidsFirst(v) ? 'You made it right.' : 'You told the truth.';
    const who = $('dlg-who');
    who.querySelectorAll('label').forEach((x) => x.remove());
    who.classList.toggle('hidden', v.repairs.length < 2);
    $('dlg-who-error').classList.add('hidden');
    v.repairs.forEach((t, i) => {
      const label = document.createElement('label');
      label.className = 'choice';
      label.innerHTML = `<input type="checkbox" name="dlg-repair" value="${t}" class="sr-only" ${i === 0 ? 'checked' : ''} />
        <span class="choice-body flex items-center gap-3"><span class="checkmark" aria-hidden="true"></span><span class="font-medium text-stone-800" data-f="l"></span></span>`;
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
    disclosingId = null;
  }

  function onDiscloseSubmit(e) {
    e.preventDefault();
    const entry = VT.store.getLog(disclosingId);
    if (!entry) return closeDisclose();
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
    celebrate(saved);
  }

  function celebrate(entry) {
    moment = { state: 'celebrate', entry };
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function grace(entry) {
    moment = { state: 'grace', entry };
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Repair script ----------
  const scriptTo = () => document.querySelector('input[name="script-to"]:checked').value;

  function setScriptTo(to) {
    document.querySelector(`input[name="script-to"][value="${to}"]`).checked = true;
    scriptVariant = 0;
    syncScriptForm();
  }

  // Rebuild the fields that depend on who the message is for.
  function syncScriptForm() {
    const to = scriptTo();
    const s = VT.store.settings();
    const kids = to === 'kids';
    $('script-name-label').innerHTML = kids
      ? 'What you call them <span class="font-normal text-stone-500">(optional)</span>'
      : 'Their name <span class="font-normal text-stone-500">(optional, saved on this device)</span>';
    $('script-name').placeholder = kids ? 'e.g. buddy' : 'e.g. Sam';
    $('script-name').value = kids ? s.kidName : s.spouseName;
    $('script-feeling-wrap').classList.toggle('hidden', kids);
    $('script-need-wrap').classList.toggle('hidden', kids);
    $('script-kids-tip').classList.toggle('hidden', !kids);

    const sel = $('script-what');
    sel.innerHTML = '';
    const opts = VT.script.WHAT[to];
    if (kids) opts.forEach((o) => sel.appendChild(new Option(o.label, o.id)));
    else {
      // Group by virtue so food and anger options read clearly.
      [['temperance', 'With food'], ['patience', 'With my temper'], [null, '']].forEach(([vid, title]) => {
        const group = opts.filter((o) => o.virtue === vid);
        if (!group.length) return;
        const parent = title ? document.createElement('optgroup') : sel;
        if (title) parent.label = title;
        group.forEach((o) => parent.appendChild(new Option(o.label, o.id)));
        if (title) sel.appendChild(parent);
      });
    }
    renderScript();
  }

  function scriptInputs() {
    return {
      to: scriptTo(),
      name: $('script-name').value,
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
    toast(scriptTo() === 'kids' ? 'Copied. Say it at their eye level.' : 'Copied. Send it before the doubt talks you out of it.');
  }

  async function shareScript() {
    try {
      await navigator.share({ text: $('script-output').value });
    } catch (err) {
      /* user closed the share sheet */
    }
  }

  // One timer per field, so typing in one name doesn't cancel a pending save of the other.
  const nameTimers = {};
  function saveNameSoon(key, value) {
    clearTimeout(nameTimers[key]);
    nameTimers[key] = setTimeout(() => {
      VT.store.updateSettings({ [key]: value });
      render();
    }, 300);
  }

  // ---------- Settings ----------
  function renderSettings(s) {
    const wrap = $('virtue-toggles');
    wrap.innerHTML = '';
    VT.VIRTUES.forEach((v) => wrap.appendChild(VT.ui.pill(`${v.name} · ${v.area}`, { toggleVirtue: v.id }, { pressed: s.activeVirtues.includes(v.id) })));
    // Don't overwrite a field while it's being typed in.
    if (document.activeElement !== $('set-spouse')) $('set-spouse').value = s.spouseName;
    if (document.activeElement !== $('set-kids')) $('set-kids').value = s.kidName;
    // The repair script has its own name field; keep it in step with names saved elsewhere.
    const scriptName = scriptTo() === 'kids' ? s.kidName : s.spouseName;
    if (document.activeElement !== $('script-name') && $('script-name').value.trim() !== scriptName) {
      $('script-name').value = scriptName;
      renderScript();
    }
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
    // Keep in-progress forms: only rebuild the friction sliders, and only reset the log form if its virtue changed.
    buildFrictionSliders(after.activeVirtues);
    if (after.lastVirtue !== before) VT.today.resetLogForm();
    render();
    toast(resting ? `${VT.virtueById(id).name} is resting. Its history stays.` : `${VT.virtueById(id).name} is active.`);
  }

  // ---------- Weekly check-in ----------
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
        <div class="flex items-baseline justify-between">
          <label for="friction-${id}" class="field-label flex items-center gap-2"><span class="vdot"></span><span data-f="n"></span></label>
          <output id="friction-${id}-out" class="font-serif text-2xl text-stone-800 tabular-nums">5</output>
        </div>
        <input type="range" id="friction-${id}" min="1" max="10" step="1" value="5" class="slider w-full mt-2" data-out="friction-${id}-out" data-virtue="${id}" />`;
      div.querySelector('.vdot').style.background = v.color;
      div.querySelector('[data-f="n"]').textContent = `${v.name} · ${v.area}`;
      wrap.appendChild(div);
      if (prev[id]) VT.ui.setSlider(`friction-${id}`, prev[id]);
    });
  }

  // Pre-select "where did your energy go" from the week's actual logs; the person can override.
  function prefillEnergy() {
    if (energyTouched) return;
    const weekOf = $('week-of').value;
    const hint = $('energy-hint');
    hint.textContent = '';
    document.querySelectorAll('input[name="energy"]').forEach((x) => (x.checked = false));
    if (!weekOf) return;
    const end = VT.dates.addDays(weekOf, 6);
    const wk = VT.store.logs().filter((l) => l.date >= weekOf && l.date <= end);
    const acts = wk.filter(VT.isDoneAct).length;
    const fights = wk.filter((l) => l.kind === 'urge' || l.kind === 'slip').length;
    if (!acts && !fights) return;
    const value = acts > 0 && acts >= fights ? 'initiation' : 'restriction';
    document.querySelector(`input[name="energy"][value="${value}"]`).checked = true;
    hint.textContent = `From your logs that week: ${VT.plural(acts, 'good act')} · ${VT.plural(fights, 'urge or slip', 'urges or slips')}. Pre-selected — change it if that’s not how it felt.`;
  }

  function resetWeeklyForm() {
    $('weekly-form').reset();
    energyTouched = false;
    $('week-of').value = VT.dates.weekStart(VT.dates.today());
    buildFrictionSliders(VT.store.settings().activeVirtues);
    $('weekly-error').classList.add('hidden');
    prefillEnergy();
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
    $('weekly-feedback').classList.remove('hidden');

    resetWeeklyForm();
    render();
    toast('Check-in saved');
    $('weekly-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- Data ----------
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
        moment = null;
        VT.today.forget();
        VT.today.resetLogForm();
        resetWeeklyForm();
        $('weekly-feedback').classList.add('hidden');
        syncScriptForm();
        render();
        toast(`Imported ${n.logs} logs and ${n.weeklies} check-ins`);
      } catch (err) {
        if (err && err.message === 'Could not save imported data') return toast(VT.ui.SAVE_FAILED);
        toast('That file couldn’t be read as Virtue Tracker data. Nothing was changed.');
      }
    });
  }

  function onReset() {
    if (!confirm('Permanently clear all logs and check-ins from this browser? Your virtues, good acts and plans stay. Export first if you want a backup.')) return;
    if (!VT.store.clear()) return toast(VT.ui.SAVE_FAILED);
    VT.today.forget();
    moment = null;
    $('weekly-feedback').classList.add('hidden');
    render();
    toast('All logs cleared');
  }

  // ---------- Why tab: reading sections ----------
  // An open section keeps its title pinned while you read, ends with a close button, and closing it
  // from anywhere brings you back to that section's title instead of leaving you further down the page.
  const headerOffset = () => {
    const header = document.querySelector('header');
    return getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0;
  };

  // Height covered by pinned title bars above a section: the desktop header, plus an open parent section.
  function pinnedAbove(details) {
    let h = headerOffset();
    const parent = details.parentElement.closest('details.foundation');
    if (parent && parent.open) h += parent.querySelector(':scope > summary').offsetHeight;
    return h;
  }

  function initReading() {
    const sync = () => document.documentElement.style.setProperty('--sticky-top', `${headerOffset()}px`);
    sync();
    window.addEventListener('resize', sync);

    document.querySelectorAll('#foundations details.foundation, #foundations details.vice').forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'collapse-btn';
      btn.innerHTML = `${d.classList.contains('vice') ? 'Close' : 'Close section'} <span aria-hidden="true">&uarr;</span>`;
      btn.addEventListener('click', () => (d.open = false));
      d.querySelector(':scope > .foundation-body, :scope > .vice-body').appendChild(btn);
    });

    // 'toggle' doesn't bubble, so listen in the capture phase.
    $('foundations').addEventListener(
      'toggle',
      (e) => {
        const d = e.target;
        if (d.open || !(d.classList.contains('foundation') || d.classList.contains('vice'))) return;
        const top = pinnedAbove(d);
        const rect = d.getBoundingClientRect();
        if (rect.top >= top) return;
        // Jump, don't glide: the page-wide smooth scrolling would animate past the collapsed title.
        const root = document.documentElement;
        const prev = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        window.scrollTo(0, window.scrollY + rect.top - top - 8);
        root.style.scrollBehavior = prev;
      },
      true
    );
  }

  // ---------- Boot ----------
  function init() {
    VT.app = { render, celebrate, grace };

    // Static scripture placements (Honesty card, Why tab).
    document.querySelectorAll('figure[data-verse]').forEach((el) => VT.scripture.render(el, el.dataset.verse));
    initReading();
    $('translation-note').textContent = `${VT.TRANSLATION.notice} Tap “Read in NIV” on any verse for the New International Version.`;

    VT.today.init();
    resetWeeklyForm();
    if (navigator.share) $('script-share').classList.remove('hidden');
    syncScriptForm();

    document.addEventListener('input', (e) => {
      const out = e.target.dataset && e.target.dataset.out;
      if (out) $(out).textContent = e.target.value;
    });

    $('moment-told').addEventListener('click', () => openDisclose($('moment').dataset.entry));
    $('moment-dismiss').addEventListener('click', onMomentDismiss);
    $('moment-script').addEventListener('click', onMomentScript);
    $('disclose-form').addEventListener('submit', onDiscloseSubmit);
    $('dlg-cancel').addEventListener('click', closeDisclose);
    $('disclose-dialog').addEventListener('cancel', () => (disclosingId = null));

    document.querySelectorAll('input[name="script-to"]').forEach((r) =>
      r.addEventListener('change', () => {
        scriptVariant = 0;
        syncScriptForm();
      })
    );
    $('script-name').addEventListener('input', () => {
      saveNameSoon(scriptTo() === 'kids' ? 'kidName' : 'spouseName', $('script-name').value);
      renderScript();
    });
    ['script-what', 'script-feeling', 'script-need'].forEach((id) => $(id).addEventListener('change', renderScript));
    $('script-what-custom').addEventListener('input', renderScript);
    $('script-copy').addEventListener('click', copyScript);
    $('script-share').addEventListener('click', shareScript);
    $('script-next').addEventListener('click', () => {
      scriptVariant = (scriptVariant + 1) % VT.script.count(scriptTo());
      renderScript();
    });

    $('journey-filter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-jv]');
      if (!b) return;
      journeyVirtue = b.dataset.jv || null;
      render();
    });
    $('virtue-toggles').addEventListener('click', onVirtueToggle);
    $('set-spouse').addEventListener('input', () => saveNameSoon('spouseName', $('set-spouse').value));
    $('set-kids').addEventListener('input', () => saveNameSoon('kidName', $('set-kids').value));

    $('weekly-form').addEventListener('submit', onWeeklySubmit);
    $('weekly-form').addEventListener('change', (e) => {
      $('weekly-error').classList.add('hidden');
      if (e.target.name === 'energy') energyTouched = true;
      if (e.target.id === 'week-of') prefillEnergy();
    });
    $('recent-list').addEventListener('click', onRecentClick);
    $('export-btn').addEventListener('click', onExport);
    $('import-input').addEventListener('change', onImport);
    $('reset-btn').addEventListener('click', onReset);

    window.addEventListener('hashchange', () => showTab(tabFromHash()));
    document.addEventListener('click', onTabClick);
    // Timers are throttled in background tabs; re-sync the moment the page is visible again.
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && render());

    VT.charts.init();
    showTab(tabFromHash(), { scroll: false });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
