// Today tab: pick a virtue, log good acts (with "did it help?"), keep if-then plans,
// and log pulls or slips with the need underneath and the repair that follows.
(function () {
  const { $, toast } = VT.ui;

  // Form state that must survive re-renders.
  let needSel = null;
  let altSel = null;
  let altLift = null;
  let actFollow = null; // { id, ask: 'lift' | 'expect' }
  let followTimer = null;

  const PLAN_EXAMPLES = {
    temperance: 'e.g. When I get home after a hard day → I change clothes and walk for 10 minutes.',
    patience: 'e.g. When the kids won’t get in the car → I kneel down and lower my voice.',
    diligence: 'e.g. When I open my laptop → I do the hardest task first, before email.',
  };

  const settings = () => VT.store.settings();
  const currentId = () => VT.store.setting('lastVirtue');
  const current = () => VT.virtueById(currentId());
  const kind = () => document.querySelector('input[name="kind"]:checked').value;

  // ---------- Virtue selection ----------
  function selectVirtue(id) {
    if (id === currentId()) return;
    VT.store.updateSettings({ lastVirtue: id });
    closeFollowup(true);
    resetLogForm();
    VT.app.render();
  }

  function renderRows(ctx) {
    const wrap = $('virtue-rows');
    wrap.innerHTML = '';
    // The overall summary already measured each active virtue; reuse it instead of re-measuring.
    ctx.overall.perVirtue.forEach((sum) => {
      const id = sum.id;
      const v = VT.virtueById(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vrow';
      b.dataset.virtue = id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(id === ctx.settings.lastVirtue));
      b.innerHTML =
        '<span class="vrow-top"><span class="vdot"></span><span class="vname"></span><span class="varea"></span><span class="vphase"></span></span>' +
        '<span class="vtrack"><span class="vmarker"></span></span>';
      b.querySelector('.vdot').style.background = v.color;
      b.querySelector('.vname').textContent = v.name;
      b.querySelector('.varea').textContent = v.area;
      b.querySelector('.vphase').textContent = sum.phase;
      const m = b.querySelector('.vmarker');
      m.style.left = `${VT.ui.clampPct(sum.score)}%`;
      m.style.opacity = sum.score == null ? '0.35' : '1';
      wrap.appendChild(b);
    });

    const o = ctx.overall;
    const bits = [`${VT.plural(o.acts30, 'good act')} · ${VT.plural(o.fights30, 'urge or slip', 'urges or slips')} in 30 days`];
    if (ctx.honesty.slips30) bits.push(`${ctx.honesty.shared30} of ${ctx.honesty.slips30} slips made right`);
    if (ctx.due == null) bits.push('First weekly check-in whenever you’re ready');
    else if (ctx.due <= 0) bits.push('Weekly check-in ready');
    $('snap-meta').textContent = bits.join(' · ');
  }

  // ---------- Good acts ----------
  const actMode = () => document.querySelector('input[name="act-mode"]:checked').value;

  function renderActChips(s) {
    const wrap = $('act-chips');
    wrap.innerHTML = '';
    const acts = VT.actsFor(s.acts, s.lastVirtue);
    if (!acts.length) {
      const p = document.createElement('p');
      p.className = 'text-sm text-stone-500';
      p.textContent = 'No good acts for this virtue yet — tap Edit list to add the things that genuinely help.';
      wrap.appendChild(p);
      return;
    }
    acts.forEach((a) => wrap.appendChild(VT.ui.pill(a.label, { act: a.id }, { cls: 'pill-act' })));
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
    openFollowup(saved.id, planned ? 'expect' : 'lift');
    VT.app.render();
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
    $('act-note').value = '';
    const count = VT.store.logs().filter(VT.isDoneAct).length;
    VT.ui.verse($('act-verse'), ask === 'lift' ? VT.scripture.pick(VT.SCRIPTURE.goodAct, count) : null);
  }

  function closeFollowup(saveNote = true) {
    clearTimeout(followTimer);
    if (actFollow && saveNote) {
      const note = $('act-note').value.trim();
      if (note) VT.store.updateLog(actFollow.id, { note });
    }
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
    } else {
      if (entry.expectLift != null) {
        keepOpen = true;
        const d = v - entry.expectLift;
        result =
          `You expected ${entry.expectLift}/5. It was ${v}/5.` +
          (d > 0 ? ' Better than the low mood predicted.' : d < 0 ? ' Less than hoped — still a rep that counts.' : ' Right on.');
      } else {
        result = `Noted — ${VT.LIFT_LABELS[v].toLowerCase()}.`;
      }
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
        '<div class="min-w-0 flex-1"><p class="text-sm font-medium text-stone-800" data-f="label"></p><p class="text-xs text-stone-500" data-f="meta"></p></div>' +
        '<button type="button" class="btn-ghost text-sm" data-upnext-done></button>' +
        '<button type="button" class="text-xs text-stone-400 hover:text-stone-700 px-1" data-upnext-drop aria-label="Remove">Not today</button>';
      li.querySelector('[data-f="label"]').textContent = l.label;
      li.querySelector('[data-f="meta"]').textContent =
        (l.expectLift != null ? `Expecting ${l.expectLift}/5 · ` : '') + (l.date === VT.dates.today() ? 'today' : `since ${VT.dates.pretty(l.date)}`);
      li.querySelector('[data-upnext-done]').textContent = 'Did it';
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
      $('act-followup').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      li.className = 'text-sm text-stone-500';
      li.textContent = PLAN_EXAMPLES[v.id] || '';
      list.appendChild(li);
    }
    plans.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'plan';
      li.innerHTML =
        '<p class="text-sm text-stone-700"><span class="text-stone-500">When</span> <span data-f="when"></span>, <span class="text-stone-500">I will</span> <span data-f="then"></span>.</p>' +
        '<div class="mt-2 flex items-center gap-4"><button type="button" class="link-btn" data-plan-did>I did it</button>' +
        '<button type="button" class="text-xs text-stone-400 hover:text-stone-700" data-plan-del>Remove</button></div>';
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
      $('act-followup').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast('You kept the plan.');
    } else if (del) {
      if (!VT.store.updateSettings({ plans: s.plans.filter((p) => p.id !== del.dataset.id) })) return toast(VT.ui.SAVE_FAILED);
      VT.app.render();
      toast('Plan removed');
    }
  }

  // ---------- Pull / slip log ----------
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
          <span class="block font-medium text-stone-800 mt-1" data-f="name"></span>
        </span>`;
      label.querySelector('[data-f="name"]').textContent = s.name;
      wrap.appendChild(label);
    });
  }

  // Rebuilt only when the virtue changes or the form resets, so in-progress choices survive re-renders.
  function syncVirtueForm() {
    const v = current();
    $('kind-urge-label').textContent = v.urgeLabel;
    $('kind-urge-hint').textContent = v.urgeHint;
    $('kind-slip-label').textContent = v.slipLabel;
    $('kind-slip-hint').textContent = v.slipHint;
    $('slip-intro').textContent = v.slipIntro;
    $('slip-win').textContent = v.slipWin;
    VT.ui.verse($('slip-verse'), v.repairs.length ? VT.SCRIPTURE.slip : VT.SCRIPTURE.grace);

    const wrap = $('repair-options');
    wrap.innerHTML = '';
    v.repairs.forEach((t) => {
      const label = document.createElement('label');
      label.className = 'choice';
      label.innerHTML = `
        <input type="checkbox" name="repair" value="${t}" class="sr-only" />
        <span class="choice-body flex items-start gap-3">
          <span class="checkmark" aria-hidden="true"></span>
          <span>
            <span class="block font-medium text-stone-800" data-repair-label="${t}"></span>
            <span class="block text-xs text-stone-500 mt-0.5" data-f="hint"></span>
          </span>
        </span>`;
      label.querySelector('[data-repair-label]').textContent = VT.REPAIRS[t].done();
      label.querySelector('[data-f="hint"]').textContent = VT.REPAIRS[t].doneHint;
      wrap.appendChild(label);
    });

    const needs = $('need-chips');
    needs.innerHTML = '';
    v.needs.forEach((id) => {
      const n = VT.needById(id);
      needs.appendChild(VT.ui.pill(n.name, { need: id }, { pressed: id === needSel, hint: n.hint }));
    });
    VT.ui.verse($('need-verse'), needSel ? VT.SCRIPTURE.needs[needSel] : null);
  }

  function syncLogForm() {
    const v = current();
    const slip = kind() === 'slip';
    const repaired = [...document.querySelectorAll('input[name="repair"]:checked')].length > 0;
    const kidsFirst = VT.kidsFirst(v);

    $('urge-fields').classList.toggle('hidden', slip);
    $('slip-fields').classList.toggle('hidden', !slip);
    $('slip-predict-wrap').classList.toggle('hidden', !v.repairs.length);
    $('slip-actual-row').classList.toggle('hidden', !repaired);
    $('slip-predicted-label').textContent = repaired
      ? 'Before you made it right, how hard did you expect it to go?'
      : kidsFirst
        ? 'Before you make it right: how hard do you expect it to go?'
        : `Before you tell ${VT.spouse('them')}: how hard do you expect it to go?`;

    const note = $('slip-window-note');
    if (v.repairs.length && !repaired) {
      note.textContent = kidsFirst
        ? 'Saving starts a 15-minute repair window. The pull to move on and pretend it didn’t happen is strongest right after.'
        : 'Saving starts a 15-minute honesty window. The urge to hide is loudest right after — you won’t have to face it alone.';
      note.classList.remove('hidden');
    } else {
      note.classList.add('hidden');
    }

    $('log-note').placeholder = slip ? v.notes.slip : v.notes.urge;
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
    const show = kind() === 'urge' && !!needSel;
    $('alt-section').classList.toggle('hidden', !show);
    if (!show) {
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
      p.className = 'text-sm text-stone-500';
      p.textContent = 'None of your good acts are tagged for this need yet — add some with Edit list above.';
      wrap.appendChild(p);
    }
    acts.forEach((a) =>
      wrap.appendChild(
        VT.ui.pill(a.label, { alt: a.id }, { pressed: a.id === altSel, cls: 'pill-act', hint: liftMap[a.id] ? `helps ${VT.round1(liftMap[a.id])}` : '' })
      )
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

  function resetLogForm() {
    $('log-form').reset();
    $('log-date').value = VT.dates.today();
    $('log-date').max = VT.dates.today();
    $('stage-error').classList.add('hidden');
    $('stage-desc').textContent = 'Tap the stage that fits best.';
    VT.ui.setSlider('slip-predicted', 5);
    VT.ui.setSlider('slip-actual', 5);
    needSel = null;
    altSel = null;
    altLift = null;
    syncVirtueForm();
    syncLogForm();
  }

  function onLogChange(e) {
    if (e.target.name === 'kind' || e.target.name === 'repair') syncLogForm();
    if (e.target.name === 'stage') {
      const st = VT.stageById(e.target.value);
      const ex = current().examples[st.id];
      $('stage-error').classList.add('hidden');
      $('stage-desc').textContent = `${st.desc} For example: “${ex}”`;
    }
  }

  function onLogSubmit(e) {
    e.preventDefault();
    const v = current();
    const date = $('log-date').value || VT.dates.today();
    const note = $('log-note').value;

    if (kind() === 'slip') {
      const repairsDone = [...document.querySelectorAll('input[name="repair"]:checked')].map((x) => x.value);
      const saved = VT.store.addLog({
        date,
        kind: 'slip',
        virtue: v.id,
        need: needSel,
        note,
        repairsDone,
        predicted: $('slip-predicted').value,
        actual: $('slip-actual').value,
      });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      resetLogForm();
      if (saved.disclosed) VT.app.celebrate(saved);
      else if (v.repairs.length) {
        VT.app.render();
        toast('Logged. You’re not in trouble, and you’re not alone.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else VT.app.grace(saved);
      return;
    }

    const picked = document.querySelector('input[name="stage"]:checked');
    if (!picked) {
      $('stage-error').classList.remove('hidden');
      document.querySelector('input[name="stage"]').focus();
      return;
    }
    const saved = VT.store.addLog({ date, kind: 'urge', virtue: v.id, stage: picked.value, need: needSel, note });
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
          resetLogForm();
          VT.app.render();
          return toast(VT.ui.SAVE_FAILED);
        }
      }
    }
    resetLogForm();
    VT.app.render();
    toast(`Logged · ${VT.stageById(saved.stage).name}` + (chosen ? ` · and you chose ${chosen.label}` : ''));
  }

  // ---------- Good-acts editor ----------
  function actRow(a) {
    const li = document.createElement('li');
    li.className = 'act-edit';
    li.dataset.id = a.id;
    li.innerHTML =
      '<div class="flex gap-2"><input class="field text-sm" maxlength="60" aria-label="Good act" placeholder="e.g. Went for a walk" />' +
      '<button type="button" class="btn-ghost text-sm shrink-0" data-remove aria-label="Remove">Remove</button></div>' +
      '<p class="tag-label">Counts toward</p><div class="mt-1 flex flex-wrap gap-1.5" data-group="vt"></div>' +
      '<p class="tag-label">Meets the need for</p><div class="mt-1 flex flex-wrap gap-1.5" data-group="nd"></div>';
    li.querySelector('input').value = a.label;
    const vt = li.querySelector('[data-group="vt"]');
    VT.VIRTUES.forEach((v) => vt.appendChild(VT.ui.pill(v.name, { vt: v.id }, { pressed: a.virtues.includes(v.id), cls: 'pill-sm' })));
    const nd = li.querySelector('[data-group="nd"]');
    VT.NEEDS.forEach((n) => nd.appendChild(VT.ui.pill(n.name, { nd: n.id }, { pressed: a.needs.includes(n.id), cls: 'pill-sm' })));
    return li;
  }

  function openActsEditor() {
    const list = $('acts-edit-list');
    list.innerHTML = '';
    settings().acts.forEach((a) => list.appendChild(actRow(a)));
    VT.ui.openDialog($('acts-dialog'));
  }

  function closeActsEditor() {
    VT.ui.closeDialog($('acts-dialog'));
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
    if (acts.length > VT.store.LIST_MAX) return toast(`Keep it to ${VT.store.LIST_MAX} good acts — remove a few before saving.`);
    if (!VT.store.updateSettings({ acts })) return toast(VT.ui.SAVE_FAILED);
    closeActsEditor();
    VT.app.render();
    renderAlts();
    toast('Good acts saved');
  }

  // ---------- Public ----------
  VT.today = {
    current,
    resetLogForm,
    // An entry was deleted elsewhere: drop its follow-up so a note typed there isn't silently lost.
    forget(id) {
      if (!id || (actFollow && actFollow.id === id)) closeFollowup(false);
    },

    init() {
      renderStageOptions();
      resetLogForm();
      $('virtue-rows').addEventListener('click', (e) => {
        const b = e.target.closest('[data-virtue]');
        if (b) selectVirtue(b.dataset.virtue);
      });
      $('act-chips').addEventListener('click', onActChip);
      $('act-rate').addEventListener('click', onActRate);
      $('act-followup-done').addEventListener('click', () => closeFollowup(true));
      $('upnext-list').addEventListener('click', onUpNextClick);
      $('plan-form').addEventListener('submit', onPlanSubmit);
      $('plans-list').addEventListener('click', onPlansClick);
      $('log-form').addEventListener('submit', onLogSubmit);
      $('log-form').addEventListener('change', onLogChange);
      $('need-chips').addEventListener('click', onNeedClick);
      $('alt-chips').addEventListener('click', onAltClick);
      $('alt-rate').addEventListener('click', onAltRate);
      $('acts-edit').addEventListener('click', openActsEditor);
      $('acts-edit-list').addEventListener('click', onActsEditClick);
      $('acts-add').addEventListener('click', () => {
        const li = actRow({ id: VT.uid(), label: '', needs: [], virtues: [currentId()] });
        $('acts-edit-list').appendChild(li);
        li.querySelector('input').focus();
      });
      $('acts-form').addEventListener('submit', onActsSave);
      $('acts-cancel').addEventListener('click', closeActsEditor);
    },

    render(ctx) {
      const v = VT.virtueById(ctx.settings.lastVirtue);
      renderRows(ctx);
      $('today-verse-label').textContent = `Verse for today · ${v.name}`;
      VT.ui.verse($('today-verse'), VT.scripture.ofTheDay(v.verses));
      renderActChips(ctx.settings);
      renderUpNext(ctx.logs);
      renderPlans(ctx.settings);
      // Names can change while the form is open; refresh label text without rebuilding inputs.
      document.querySelectorAll('[data-repair-label]').forEach((el) => (el.textContent = VT.REPAIRS[el.dataset.repairLabel].done()));
      if (kind() === 'slip') syncLogForm();
    },
  };
})();
