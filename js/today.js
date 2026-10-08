// Today tab: pick a virtue, meet an urge (stage, need, a better choice), tap a slip straight into the
// Honest Script, log good acts with "did it help?", and keep if-then plans.
(function () {
  const { $, toast } = VT.ui;

  // Form state that must survive re-renders.
  let stageSel = null;
  let needSel = null;
  let altSel = null;
  let altLift = null;
  let actFollow = null; // { id, ask: 'lift' | 'expect' }
  let followTimer = null;
  let graceId = null;
  let bloomId = null;
  let dateTouched = false; // the urge's day was picked by hand; otherwise it follows today, even past midnight
  let noteTimer = null;

  const PLAN_EXAMPLES = {
    temperance: 'e.g. When I get home after a hard day → I change clothes and walk for 10 minutes.',
    patience: 'e.g. When the kids won’t get in the car → I kneel down and lower my voice.',
    diligence: 'e.g. When I open my laptop → I do the hardest task first, before email.',
  };

  const settings = () => VT.store.settings();
  const currentId = () => VT.store.setting('lastVirtue');
  const current = () => VT.virtueById(currentId());

  // ---------- Header ----------
  function renderGreeting() {
    const d = new Date();
    const hr = d.getHours();
    $('today-date').textContent = `${d.toLocaleDateString(undefined, { weekday: 'long' })} · ${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
    $('greeting').textContent = hr < 12 ? 'Good morning.' : hr < 17 ? 'Good afternoon.' : 'Good evening.';
  }

  // ---------- Virtue selection ----------
  function selectVirtue(id) {
    if (id === currentId()) return;
    if (!VT.store.updateSettings({ lastVirtue: id })) return toast(VT.ui.SAVE_FAILED);
    closeFollowup(true);
    resetUrge({ keep: true });
    hideGrace();
    VT.app.render();
  }

  function renderSeg(s) {
    const seg = $('virtue-seg');
    seg.innerHTML = '';
    s.activeVirtues.forEach((id) => {
      const v = VT.virtueById(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.virtue = id;
      b.setAttribute('aria-pressed', String(id === s.lastVirtue));
      b.innerHTML = '<span class="vdot"></span><span></span>';
      b.firstChild.style.background = v.color;
      b.lastChild.textContent = v.name;
      seg.appendChild(b);
    });
  }

  function renderDoors() {
    const v = current();
    $('urge-hint').textContent = v.urgeDoor;
    $('slip-label').textContent = v.slipDoor;
    $('slip-hint').textContent = v.slipDoorHint;
  }

  // ---------- Where you are: the trail ----------
  // The trail is three cubic curves; sample it once so markers can be placed by score without layout APIs.
  const TRAIL_D = 'M18,112 C72,110 98,88 144,84 C190,80 224,70 254,54 C284,38 302,36 320,32';
  const TRAIL = (() => {
    const segs = [
      [[18, 112], [72, 110], [98, 88], [144, 84]],
      [[144, 84], [190, 80], [224, 70], [254, 54]],
      [[254, 54], [284, 38], [302, 36], [320, 32]],
    ];
    const bez = (p, t) => {
      const u = 1 - t;
      return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
    };
    const pts = [];
    segs.forEach((p, si) => {
      for (let i = si ? 1 : 0; i <= 60; i++) pts.push(bez(p, i / 60));
    });
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = len[len.length - 1];
    return (pct) => {
      const target = (total * Math.max(0, Math.min(100, pct))) / 100;
      let i = len.findIndex((l) => l >= target);
      if (i <= 0) return pts[0];
      const f = (target - len[i - 1]) / (len[i] - len[i - 1] || 1);
      return [pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])];
    };
  })();

  function renderTrail(ctx) {
    const W = 340;
    const H = 132;
    const sel = ctx.settings.lastVirtue;
    const calm = VT.ui.reducedMotion();
    const stars = [[40, 22], [92, 14], [150, 30], [210, 12], [262, 24], [120, 46], [180, 40]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.3}" style="fill: var(--star)" opacity="${0.35 + 0.15 * (i % 3)}"${i % 2 && !calm ? ' class="pulse"' : ''}/>`)
      .join('');
    // Selected virtue last so it sits on top.
    const order = [...ctx.overall.perVirtue].sort((a, b) => (a.id === sel) - (b.id === sel));
    const markers = order
      .map((p) => {
        const v = VT.virtueById(p.id);
        const [x, y] = TRAIL(p.score == null ? 0 : p.score);
        const on = p.id === sel;
        const faint = p.score == null ? ' opacity=".5"' : '';
        return (
          (on ? `<circle cx="${x}" cy="${y}" r="13" style="fill: ${v.color}" opacity=".22">${calm ? '' : '<animate attributeName="r" values="11;15;11" dur="10s" repeatCount="indefinite"/>'}</circle>` : '') +
          `<circle cx="${x}" cy="${y}" r="${on ? 7 : 5.5}" style="fill: ${v.color}; stroke: var(--marker-ring)" stroke-width="2.5"${faint}><title>${v.name}: ${p.phase}</title></circle>`
        );
      })
      .join('');
    $('trail').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your virtues on the path from duty to second nature">
      <defs><linearGradient id="vt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--sky-1)"/><stop offset="1" style="stop-color: var(--sky-2)"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#vt-sky)"/>
      <g class="night">${stars}<circle cx="306" cy="30" r="13" style="fill: var(--sun)" opacity=".9"/><circle cx="312" cy="26" r="11" style="fill: var(--sky-1)"/></g>
      <g class="day"><circle cx="306" cy="30" r="22" style="fill: var(--sun)" opacity=".35"/><circle cx="306" cy="30" r="13" style="fill: var(--sun)"/></g>
      <path d="M0,${H} L0,98 C60,82 112,96 172,88 C232,78 282,70 ${W},76 L${W},${H}Z" style="fill: var(--hill-1)"/>
      <path d="M0,${H} L0,114 C70,102 142,118 212,106 C272,96 312,102 ${W},97 L${W},${H}Z" style="fill: var(--hill-2)"/>
      <path d="${TRAIL_D}" fill="none" style="stroke: var(--trail)" stroke-width="2" stroke-dasharray="1.5 6" stroke-linecap="round"/>
      <text x="18" y="100" font-size="8.5" style="fill: var(--trail-label)" letter-spacing=".1em">DUTY</text>
      <text x="282" y="34" font-size="8.5" style="fill: var(--trail-label)" text-anchor="end" letter-spacing=".1em">SECOND NATURE</text>
      ${markers}</svg>`;

    const list = $('paths');
    list.innerHTML = '';
    ctx.overall.perVirtue.forEach((p) => {
      const v = VT.virtueById(p.id);
      const li = document.createElement('li');
      li.className = 'path-row';
      li.innerHTML = '<span class="path-name"><span class="vdot"></span><span></span></span><span class="path-phase"></span>';
      li.querySelector('.vdot').style.background = v.color;
      const name = li.querySelector('.path-name > span:last-child');
      name.textContent = v.name;
      name.className = p.id === ctx.settings.lastVirtue ? 'text-cloud font-medium' : 'text-mist';
      li.querySelector('.path-phase').textContent = p.phase;
      list.appendChild(li);
    });

    const o = ctx.overall;
    const bits = [`${VT.plural(o.acts30, 'good act')} · ${VT.plural(o.fights30, 'urge or slip', 'urges or slips')} in 30 days`];
    if (ctx.honesty.slips30) bits.push(`${ctx.honesty.shared30} of ${ctx.honesty.slips30} slips made right`);
    if (ctx.due == null) bits.push('First weekly check-in whenever you’re ready');
    else if (ctx.due <= 0) bits.push('Weekly check-in ready');
    $('snap-meta').textContent = bits.join(' · ');
  }

  // ---------- An urge ----------
  function toggleUrge(open) {
    $('urge-panel').classList.toggle('hidden', !open);
    $('door-urge').setAttribute('aria-expanded', String(open));
    if (open) {
      hideGrace();
      requestAnimationFrame(() => VT.ui.reveal($('urge-panel')));
    }
  }

  function renderStageOptions() {
    const wrap = $('stage-options');
    wrap.innerHTML = '';
    VT.STAGES.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'stage-btn';
      b.dataset.stage = String(s.id);
      b.setAttribute('aria-pressed', String(stageSel === s.id));
      b.innerHTML = '<span class="stage-num"><span class="stage-dot"></span><span></span></span><span class="stage-name"></span>';
      b.querySelector('.stage-dot').style.background = s.color;
      b.querySelector('.stage-num > span:last-child').textContent = `Stage ${s.id}`;
      b.querySelector('.stage-name').textContent = s.name;
      wrap.appendChild(b);
    });
  }

  function describeStage() {
    if (!stageSel) {
      $('stage-desc').textContent = 'Tap the stage that fits best.';
      return;
    }
    const st = VT.stageById(stageSel);
    $('stage-desc').textContent = `${st.desc} For example: “${current().examples[st.id]}”`;
  }

  function onStageClick(e) {
    const b = e.target.closest('[data-stage]');
    if (!b) return;
    stageSel = Number(b.dataset.stage);
    $('stage-options').querySelectorAll('[data-stage]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    describeStage();
  }

  // Rebuilt when the virtue changes or the form resets, so in-progress choices survive re-renders.
  function syncUrgeForm() {
    const v = current();
    const needs = $('need-chips');
    needs.innerHTML = '';
    v.needs.forEach((id) => {
      const n = VT.needById(id);
      needs.appendChild(VT.ui.pill(n.name, { need: id }, { pressed: id === needSel, hint: n.hint }));
    });
    VT.ui.verse($('need-verse'), needSel ? VT.SCRIPTURE.needs[needSel] : null);
    $('log-note').placeholder = v.notes.urge;
    describeStage();
    renderAlts();
  }

  function onNeedClick(e) {
    const b = e.target.closest('[data-need]');
    if (!b) return;
    needSel = needSel === b.dataset.need ? null : b.dataset.need;
    $('need-chips').querySelectorAll('[data-need]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.need === needSel)));
    VT.ui.verse($('need-verse'), needSel ? VT.SCRIPTURE.needs[needSel] : null);
    renderAlts();
  }

  function renderAlts() {
    $('alt-section').classList.toggle('hidden', !needSel);
    if (!needSel) {
      altSel = null;
      altLift = null;
      return;
    }
    const s = settings();
    const liftMap = VT.insights.liftMap(VT.store.logs(), s);
    const acts = VT.actsFor(s.acts, s.lastVirtue)
      .filter((a) => a.needs.includes(needSel))
      .sort((a, b) => (liftMap[b.id] || 0) - (liftMap[a.id] || 0));
    if (!acts.some((a) => a.id === altSel)) {
      altSel = null;
      altLift = null;
    }
    const wrap = $('alt-chips');
    wrap.innerHTML = '';
    if (!acts.length) {
      const p = document.createElement('p');
      p.className = 'text-sm text-dim';
      p.textContent = 'None of your good acts are tagged for this need yet. Add some with Edit list below.';
      wrap.appendChild(p);
    }
    acts.forEach((a) =>
      wrap.appendChild(VT.ui.pill(a.label, { alt: a.id }, { pressed: a.id === altSel, cls: 'pill-act', hint: liftMap[a.id] ? `helps ${VT.round1(liftMap[a.id])}` : '' }))
    );
    $('alt-lift').classList.toggle('hidden', !altSel);
  }

  function onAltClick(e) {
    const b = e.target.closest('[data-alt]');
    if (!b) return;
    altSel = altSel === b.dataset.alt ? null : b.dataset.alt;
    altLift = null;
    $('alt-chips').querySelectorAll('[data-alt]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.alt === altSel)));
    VT.ui.buildRate($('alt-rate'));
    $('alt-lift').classList.toggle('hidden', !altSel);
  }

  function onAltRate(e) {
    const b = e.target.closest('[data-rate]');
    if (!b) return;
    altLift = Number(b.dataset.rate);
    VT.ui.setRate($('alt-rate'), altLift);
  }

  // `keep`: switching virtue keeps the stage and note (neither is specific to a virtue); needs and choices reset.
  function resetUrge({ keep = false } = {}) {
    if (!keep) {
      stageSel = null;
      $('log-note').value = '';
      dateTouched = false;
    }
    needSel = null;
    altSel = null;
    altLift = null;
    syncDate();
    renderStageOptions();
    syncUrgeForm();
  }

  // An installed app can stay open for days: keep "today" current unless a day was picked by hand.
  function syncDate() {
    const today = VT.dates.today();
    $('log-date').max = today;
    if (!dateTouched || !$('log-date').value) $('log-date').value = today;
  }

  function onSaveUrge() {
    const v = current();
    if (!stageSel) {
      $('stage-desc').textContent = 'Pick the stage that fits best — any of them is an honest answer.';
      $('stage-options').querySelector('[data-stage]').focus();
      return;
    }
    const today = VT.dates.today();
    const picked = $('log-date').value;
    if (picked > today) {
      $('log-date').value = today;
      return toast('That day hasn’t happened yet — it’s set to today now.');
    }
    const date = picked || today;
    const saved = VT.store.addLog({ date, kind: 'urge', virtue: v.id, stage: stageSel, need: needSel, note: $('log-note').value });
    if (!saved) return toast(VT.ui.SAVE_FAILED);

    let chosen = null;
    if (altSel) {
      chosen = settings().acts.find((a) => a.id === altSel) || null;
      if (chosen) {
        const alt = VT.store.addLog({
          date,
          kind: 'act',
          actId: chosen.id,
          label: chosen.label,
          virtues: chosen.virtues.length ? chosen.virtues : [v.id],
          status: 'done',
          lift: altLift,
          linkedUrgeId: saved.id,
        });
        if (!alt) {
          // Keep it all-or-nothing: take the urge back out and leave the form as it was, ready to retry.
          VT.store.deleteLog(saved.id);
          VT.app.render();
          return toast(VT.ui.SAVE_FAILED);
        }
      }
    }
    resetUrge();
    toggleUrge(false);
    VT.app.render();
    toast(`Logged · ${VT.stageById(saved.stage).name}` + (chosen ? ` · and you chose ${chosen.label}` : ''));
  }

  // ---------- A slip with no repair step: a fresh start ----------
  function showGrace(entry) {
    graceId = entry.id;
    toggleUrge(false);
    const copy = VT.insights.moment('grace', entry);
    $('grace-eyebrow').textContent = copy.eyebrow;
    $('grace-title').textContent = copy.title;
    $('grace-body').textContent = copy.body;
    VT.ui.verse($('grace-verse'), copy.verse);
    $('grace-note').classList.remove('hidden');
    requestAnimationFrame(() => VT.ui.reveal($('grace-note')));
  }

  function hideGrace() {
    graceId = null;
    $('grace-note').classList.add('hidden');
  }

  function onGraceUndo() {
    if (!graceId) return hideGrace();
    if (!VT.store.deleteLog(graceId)) return toast(VT.ui.SAVE_FAILED);
    hideGrace();
    VT.app.render();
    toast('Removed.');
  }

  // ---------- Good acts ----------
  const actMode = () => document.querySelector('input[name="act-mode"]:checked').value;

  function renderActChips(s, logs) {
    const wrap = $('act-chips');
    wrap.innerHTML = '';
    const acts = VT.actsFor(s.acts, s.lastVirtue);
    if (!acts.length) {
      const p = document.createElement('p');
      p.className = 'text-sm text-dim';
      p.textContent = 'No good acts for this virtue yet. Tap Edit list to add the things that genuinely help.';
      wrap.appendChild(p);
    }
    acts.forEach((a) => {
      const b = VT.ui.pill(a.label, { act: a.id }, { cls: 'pill-act' });
      if (a.id === bloomId) b.classList.add('bloom');
      wrap.appendChild(b);
    });
    bloomId = null;
    const today = VT.dates.today();
    const n = logs.filter((l) => VT.isDoneAct(l) && l.date === today).length;
    $('acts-today').textContent = n ? `${VT.plural(n, 'good act')} today.` : '';
  }

  function onActChip(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const s = settings();
    const act = s.acts.find((a) => a.id === b.dataset.act);
    if (!act) return;
    const planned = actMode() === 'planned';
    const saved = VT.store.addLog({
      date: VT.dates.today(),
      kind: 'act',
      actId: act.id,
      label: act.label,
      virtues: act.virtues.length ? act.virtues : [s.lastVirtue],
      status: planned ? 'planned' : 'done',
    });
    if (!saved) return toast(VT.ui.SAVE_FAILED);
    if (!planned) bloomId = act.id;
    openFollowup(saved.id, planned ? 'expect' : 'lift');
    VT.app.render();
    requestAnimationFrame(() => VT.ui.reveal($('act-followup')));
    toast(planned ? `Up next · ${act.label}` : `Logged · ${act.label}`);
  }

  function openFollowup(id, ask) {
    const entry = VT.store.getLog(id);
    if (!entry) return;
    closeFollowup(true);
    actFollow = { id, ask };
    $('act-followup').classList.remove('hidden');
    $('act-followup-title').textContent = ask === 'expect' ? `Up next: ${entry.label}` : `Logged: ${entry.label}`;
    $('act-followup-q').textContent =
      ask === 'expect'
        ? 'How much do you expect it to help? (optional)'
        : 'How much did it help? (optional)' + (entry.expectLift != null ? ` You expected ${entry.expectLift}/5.` : '');
    VT.ui.buildRate($('act-rate'));
    $('act-followup-result').textContent = '';
    $('act-note').value = entry.note || ''; // a note added when it was planned stays
    const count = VT.store.logs().filter(VT.isDoneAct).length;
    VT.ui.verse($('act-verse'), ask === 'lift' ? VT.scripture.pick(VT.SCRIPTURE.goodAct, count) : null);
  }

  function saveFollowNote() {
    clearTimeout(noteTimer);
    if (!actFollow) return;
    const entry = VT.store.getLog(actFollow.id);
    const note = $('act-note').value.trim();
    if (entry && note !== (entry.note || '') && !VT.store.updateLog(entry.id, { note })) toast(VT.ui.SAVE_FAILED);
  }

  function closeFollowup(saveNote = true) {
    clearTimeout(followTimer);
    if (saveNote) saveFollowNote();
    clearTimeout(noteTimer);
    actFollow = null;
    $('act-followup').classList.add('hidden');
  }

  function onActRate(e) {
    const b = e.target.closest('[data-rate]');
    if (!b || !actFollow) return;
    const v = Number(b.dataset.rate);
    const entry = VT.store.getLog(actFollow.id);
    if (!entry) return closeFollowup(false);
    if (!VT.store.updateLog(entry.id, actFollow.ask === 'expect' ? { expectLift: v } : { lift: v })) return toast(VT.ui.SAVE_FAILED);
    VT.ui.setRate($('act-rate'), v);
    let result;
    let keepOpen = false;
    if (actFollow.ask === 'expect') {
      result = 'Noted. Tap “Did it” under Up next when you’re done.';
    } else if (entry.expectLift != null) {
      keepOpen = true;
      const d = v - entry.expectLift;
      result =
        `You expected ${entry.expectLift}/5. It was ${v}/5.` +
        (d > 0 ? ' Better than the low mood predicted.' : d < 0 ? ' Less than hoped — still a rep that counts.' : ' Right on.');
    } else {
      result = `Noted — ${VT.LIFT_LABELS[v].toLowerCase()}.`;
    }
    $('act-followup-result').textContent = result;
    VT.app.render();
    clearTimeout(followTimer);
    if (!keepOpen) {
      followTimer = setTimeout(() => {
        const typing = document.activeElement === $('act-note') || $('act-note').value.trim();
        if (!typing) closeFollowup(true);
      }, 2200);
    }
  }

  // ---------- Up next (planned acts) ----------
  function renderUpNext(logs) {
    const planned = logs.filter((l) => l.kind === 'act' && l.status === 'planned').sort((a, b) => a.createdAt - b.createdAt);
    $('upnext').classList.toggle('hidden', !planned.length);
    const list = $('upnext-list');
    list.innerHTML = '';
    planned.forEach((l) => {
      const li = document.createElement('li');
      li.className = 'plan flex items-center gap-3';
      li.innerHTML =
        '<div class="min-w-0 flex-1"><p class="text-sm font-medium" data-f="label"></p><p class="text-xs text-dim" data-f="meta"></p></div>' +
        '<button type="button" class="btn btn-ghost btn-sm shrink-0" data-upnext-done>Did it</button>' +
        '<button type="button" class="link-quiet shrink-0" data-upnext-drop>Not today</button>';
      li.querySelector('[data-f="label"]').textContent = l.label;
      li.querySelector('[data-f="meta"]').textContent =
        (l.expectLift != null ? `Expecting ${l.expectLift}/5 · ` : '') + (l.date === VT.dates.today() ? 'today' : `since ${VT.dates.pretty(l.date)}`);
      li.querySelector('[data-upnext-done]').dataset.id = l.id;
      li.querySelector('[data-upnext-drop]').dataset.id = l.id;
      list.appendChild(li);
    });
  }

  function onUpNextClick(e) {
    const done = e.target.closest('[data-upnext-done]');
    const drop = e.target.closest('[data-upnext-drop]');
    if (done) {
      const saved = VT.store.updateLog(done.dataset.id, { status: 'done', doneAt: Date.now(), date: VT.dates.today() });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      openFollowup(saved.id, 'lift');
      VT.app.render();
      VT.ui.reveal($('act-followup'));
      toast(`Logged · ${saved.label}`);
    } else if (drop) {
      if (actFollow && actFollow.id === drop.dataset.id) closeFollowup(false);
      if (!VT.store.deleteLog(drop.dataset.id)) return toast(VT.ui.SAVE_FAILED);
      VT.app.render();
      toast('Removed. Plans change — no judgment.');
    }
  }

  // ---------- If-then plans ----------
  function renderPlans(s) {
    const v = VT.virtueById(s.lastVirtue);
    const plans = s.plans.filter((p) => p.virtue === v.id);
    $('plans-count').textContent = plans.length ? `(${plans.length})` : '';
    $('plans-virtue').textContent = v.name.toLowerCase();

    const list = $('plans-list');
    list.innerHTML = '';
    if (!plans.length) {
      const li = document.createElement('li');
      li.className = 'text-sm text-dim';
      li.textContent = PLAN_EXAMPLES[v.id] || '';
      list.appendChild(li);
    }
    plans.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'plan';
      li.innerHTML =
        '<p class="text-sm"><span class="text-dim">When</span> <span data-f="when"></span>, <span class="text-dim">I will</span> <span data-f="then"></span>.</p>' +
        '<div class="mt-2 flex items-center gap-4"><button type="button" class="link text-sm font-medium" data-plan-did>I did it</button>' +
        '<button type="button" class="link-quiet" data-plan-del>Remove</button></div>';
      li.querySelector('[data-f="when"]').textContent = p.when.replace(/[.\s]+$/, '');
      li.querySelector('[data-f="then"]').textContent = p.then.replace(/[.\s]+$/, '');
      li.querySelector('[data-plan-did]').dataset.id = p.id;
      li.querySelector('[data-plan-del]').dataset.id = p.id;
      list.appendChild(li);
    });

    // "Counts as" options follow the current virtue's acts; keep the selection if it still exists.
    const sel = $('plan-act');
    const keep = sel.value;
    sel.innerHTML = '';
    sel.appendChild(new Option('Counts as… (optional)', ''));
    VT.actsFor(s.acts, v.id).forEach((a) => sel.appendChild(new Option(a.label, a.id)));
    sel.value = [...sel.options].some((o) => o.value === keep) ? keep : '';
  }

  function onPlanSubmit(e) {
    e.preventDefault();
    const when = $('plan-when').value.trim();
    const then = $('plan-then').value.trim();
    if (!when || !then) return $('plan-error').classList.remove('hidden');
    $('plan-error').classList.add('hidden');
    const s = settings();
    if (s.plans.length >= VT.store.LIST_MAX) return toast(`You have ${VT.store.LIST_MAX} plans — remove one before adding another.`);
    const plan = { id: VT.uid(), virtue: s.lastVirtue, when, then, actId: $('plan-act').value || null };
    if (!VT.store.updateSettings({ plans: [...s.plans, plan] })) return toast(VT.ui.SAVE_FAILED);
    $('plan-form').reset();
    VT.app.render();
    toast('Plan saved. The decision is already made.');
  }

  function onPlansClick(e) {
    const did = e.target.closest('[data-plan-did]');
    const del = e.target.closest('[data-plan-del]');
    const s = settings();
    if (did) {
      const plan = s.plans.find((p) => p.id === did.dataset.id);
      if (!plan) return;
      const act = plan.actId ? s.acts.find((a) => a.id === plan.actId) : null;
      const saved = VT.store.addLog({
        date: VT.dates.today(),
        kind: 'act',
        actId: act ? act.id : `plan:${plan.id}`,
        label: act ? act.label : plan.then.slice(0, 60),
        virtues: act && act.virtues.length ? act.virtues : [plan.virtue],
        status: 'done',
        planId: plan.id,
      });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      openFollowup(saved.id, 'lift');
      VT.app.render();
      VT.ui.reveal($('act-followup'));
      toast('You kept the plan.');
    } else if (del) {
      if (!VT.store.updateSettings({ plans: s.plans.filter((p) => p.id !== del.dataset.id) })) return toast(VT.ui.SAVE_FAILED);
      VT.app.render();
      toast('Plan removed');
    }
  }

  // ---------- Good-acts editor ----------
  function actRow(a) {
    const li = document.createElement('li');
    li.className = 'act-edit';
    li.dataset.id = a.id;
    li.innerHTML =
      '<div class="flex gap-2"><input class="field text-sm" maxlength="60" aria-label="Good act" placeholder="e.g. Went for a walk" />' +
      '<button type="button" class="btn btn-ghost btn-sm shrink-0" data-remove>Remove</button></div>' +
      '<p class="tag-label">Counts toward</p><div class="mt-1 flex flex-wrap gap-1.5" data-group="vt" role="group" aria-label="Counts toward"></div>' +
      '<p class="tag-label">Meets the need for</p><div class="mt-1 flex flex-wrap gap-1.5" data-group="nd" role="group" aria-label="Meets the need for"></div>';
    li.querySelector('input').value = a.label;
    const vt = li.querySelector('[data-group="vt"]');
    VT.VIRTUES.forEach((v) => vt.appendChild(VT.ui.pill(v.name, { vt: v.id }, { pressed: a.virtues.includes(v.id), cls: 'pill-sm' })));
    const nd = li.querySelector('[data-group="nd"]');
    VT.NEEDS.forEach((n) => nd.appendChild(VT.ui.pill(n.name, { nd: n.id }, { pressed: a.needs.includes(n.id), cls: 'pill-sm' })));
    return li;
  }

  function actsError(msg) {
    $('acts-error').textContent = msg;
    $('acts-error').classList.toggle('hidden', !msg);
  }

  function openActsEditor() {
    actsError('');
    const list = $('acts-edit-list');
    list.innerHTML = '';
    settings().acts.forEach((a) => list.appendChild(actRow(a)));
    VT.ui.openDialog($('acts-dialog'));
  }

  function onActsEditClick(e) {
    const toggle = e.target.closest('[data-vt], [data-nd]');
    if (toggle) return toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true'));
    const rm = e.target.closest('[data-remove]');
    if (rm) rm.closest('li').remove();
  }

  function onActsSave(e) {
    e.preventDefault();
    const pressed = (li, key) => [...li.querySelectorAll(`[data-${key}][aria-pressed="true"]`)].map((b) => b.dataset[key]);
    const acts = [...$('acts-edit-list').children]
      .map((li) => ({ id: li.dataset.id, label: li.querySelector('input').value.trim(), virtues: pressed(li, 'vt'), needs: pressed(li, 'nd') }))
      .filter((a) => a.label);
    if (acts.length > VT.store.LIST_MAX) return actsError(`Keep it to ${VT.store.LIST_MAX} good acts — remove ${acts.length - VT.store.LIST_MAX} before saving.`);
    if (!VT.store.updateSettings({ acts })) return actsError(VT.ui.SAVE_FAILED);
    VT.ui.closeDialog($('acts-dialog'));
    VT.app.render();
    renderAlts();
    toast('Good acts saved');
  }

  // ---------- Public ----------
  VT.today = {
    current,
    resetUrge,
    showGrace,
    // Save anything typed but not yet stored (the page is being hidden or closed).
    flush: saveFollowNote,
    // An entry was deleted elsewhere: drop anything still pointing at it so a note typed there isn't silently lost.
    forget(id) {
      if (!id || (actFollow && actFollow.id === id)) closeFollowup(false);
      if (!id || graceId === id) hideGrace();
    },

    init() {
      resetUrge();
      $('virtue-seg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-virtue]');
        if (b) selectVirtue(b.dataset.virtue);
      });
      $('door-urge').addEventListener('click', () => toggleUrge($('urge-panel').classList.contains('hidden')));
      $('door-slip').addEventListener('click', () => VT.honesty.startSlip(currentId()));
      $('cancel-urge').addEventListener('click', () => {
        resetUrge();
        toggleUrge(false);
      });
      $('save-urge').addEventListener('click', onSaveUrge);
      $('log-date').addEventListener('change', () => (dateTouched = true));
      $('act-note').addEventListener('input', () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(saveFollowNote, 600);
      });
      $('stage-options').addEventListener('click', onStageClick);
      $('need-chips').addEventListener('click', onNeedClick);
      $('alt-chips').addEventListener('click', onAltClick);
      $('alt-rate').addEventListener('click', onAltRate);
      $('grace-close').addEventListener('click', hideGrace);
      $('grace-undo').addEventListener('click', onGraceUndo);

      $('act-chips').addEventListener('click', onActChip);
      $('act-rate').addEventListener('click', onActRate);
      $('act-followup-done').addEventListener('click', () => closeFollowup(true));
      $('upnext-list').addEventListener('click', onUpNextClick);
      $('plan-form').addEventListener('submit', onPlanSubmit);
      $('plans-list').addEventListener('click', onPlansClick);
      $('acts-edit').addEventListener('click', openActsEditor);
      $('acts-edit-list').addEventListener('click', onActsEditClick);
      $('acts-add').addEventListener('click', () => {
        const li = actRow({ id: VT.uid(), label: '', needs: [], virtues: [currentId()] });
        $('acts-edit-list').appendChild(li);
        li.querySelector('input').focus();
      });
      $('acts-form').addEventListener('submit', onActsSave);
      $('acts-cancel').addEventListener('click', () => VT.ui.closeDialog($('acts-dialog')));
    },

    render(ctx) {
      const v = VT.virtueById(ctx.settings.lastVirtue);
      renderGreeting();
      syncDate();
      renderSeg(ctx.settings);
      renderDoors();
      renderTrail(ctx);
      renderActChips(ctx.settings, ctx.logs);
      renderUpNext(ctx.logs);
      renderPlans(ctx.settings);
      $('today-verse-label').textContent = `Verse for today · ${v.name}`;
      VT.ui.verse($('today-verse'), VT.scripture.ofTheDay(v.verses));
      if (graceId && !VT.store.getLog(graceId)) hideGrace();
    },
  };
})();
