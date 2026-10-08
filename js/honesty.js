// Honest Script tab: the 15-minute window after a slip, the message builder, the prediction before
// telling, and the double victory after. A slip tapped on Today lands here with the window already running.
(function () {
  const { $, toast } = VT.ui;
  const RING = 2 * Math.PI * 52; // circumference of the ring (r = 52)
  const KEEP_MS = 24 * 60 * 60 * 1000; // a closed window, or an unanswered "how did it go?", stays for a day
  const BASE_TITLE = document.title;

  const FEEL_LABELS = { down: 'Down / heavy', stressed: 'Stressed', lonely: 'Lonely', tired: 'Worn out', anxious: 'Anxious', hurried: 'Hurried', numb: 'Numb', unsure: 'Not sure' };
  const HELP_LABELS = { nothing: 'I just don’t want to hide it', listen: 'Just listen', hug: 'A hug', plan: 'Help with a plan' };

  // `edited`: the message was changed by hand, so re-renders leave it alone until a builder choice changes.
  const form = { to: 'spouse', what: 'more', whatCustom: '', feeling: 'down', need: 'nothing', variant: 0, edited: false };
  let entryId = null; // slip whose window is open (running or closed)
  let seenId = null; // last open slip the form was set up for
  let victoryId = null; // slip made right, on screen asking "how did it actually go?"
  let actual = { id: null, touched: false }; // only a slider the person actually moved is recorded
  let focusVictory = false;
  let starting = false; // a slip is being logged; ignore a second tap
  let switchTimer = null;
  let ticker = null;
  let breather = null;
  const timers = {};
  const pending = { note: null, predict: null }; // typed/moved but not yet saved: { id, value }

  const fmt = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  // The most recent slip that still needs making right and hasn't been set aside.
  function openEntry(logs, now = Date.now()) {
    return (
      logs
        .filter((l) => l.kind === 'slip' && !l.disclosed && !l.windowDismissed && l.windowEndsAt && now < l.windowEndsAt + KEEP_MS)
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null
    );
  }

  // A slip made right in the last day whose outcome hasn't been recorded or set aside. Read from saved
  // data, so it survives the app being closed while waiting for a reply.
  function pendingVictory(logs, now = Date.now()) {
    return (
      logs
        .filter((l) => l.kind === 'slip' && l.disclosed && l.actual == null && !l.outcomeSkipped && l.disclosedAt && now - l.disclosedAt < KEEP_MS)
        .sort((a, b) => b.disclosedAt - a.disclosedAt)[0] || null
    );
  }

  // Which repair "I told / I made it right" records: whoever the message is for, if that fits the slip.
  function repairTarget(v) {
    return v.repairs.includes(form.to) ? form.to : v.repairs[0];
  }

  // Set the builder up for a newly opened slip: the right person and the most likely words.
  function applyDefaults(entry) {
    const v = VT.virtueById(entry.virtue);
    form.to = VT.kidsFirst(v) ? 'kids' : 'spouse';
    form.what = form.to === 'kids' || v.id === 'patience' ? 'yelled' : 'more';
    form.whatCustom = '';
    form.variant = 0;
    form.edited = false;
    $('what-custom').value = '';
    VT.ui.setSlider('predict', entry.predicted != null ? entry.predicted : 5);
    if (entry.predicted == null) $('predict-out').textContent = '–';
    $('slip-note').value = entry.note || '';
  }

  // ---------- Saving what's typed or moved ----------
  function flushNote() {
    clearTimeout(timers.note);
    const p = pending.note;
    pending.note = null;
    if (p && VT.store.getLog(p.id) && !VT.store.updateLog(p.id, { note: p.value })) toast(VT.ui.SAVE_FAILED);
  }

  function flushPredict() {
    clearTimeout(timers.predict);
    const p = pending.predict;
    pending.predict = null;
    if (p && VT.store.getLog(p.id)) VT.store.updateLog(p.id, { predicted: p.value });
  }

  function dropPending(id) {
    ['note', 'predict'].forEach((k) => {
      if (pending[k] && (!id || pending[k].id === id)) {
        clearTimeout(timers[k]);
        pending[k] = null;
      }
    });
  }

  // ---------- Builder ----------
  function whatOptions(slipVirtue) {
    const opts = VT.script.WHAT[form.to];
    // With a slip open, offer the words that fit it (plus "Something else").
    if (form.to === 'spouse' && slipVirtue && opts.some((o) => o.virtue === slipVirtue)) return opts.filter((o) => o.virtue === slipVirtue || o.id === 'custom');
    return opts;
  }

  function chips(wrap, items, key, selected, cls) {
    wrap.innerHTML = '';
    items.forEach(([id, label]) => wrap.appendChild(VT.ui.pill(label, { [key]: id }, { pressed: id === selected, cls })));
  }

  function renderBuilder(regenerate = true) {
    const slip = entryId ? VT.store.getLog(entryId) : null;
    const opts = whatOptions(slip && slip.virtue);
    if (!opts.some((o) => o.id === form.what)) form.what = opts[0].id;
    const kids = form.to === 'kids';
    $('to-seg').querySelectorAll('[data-to]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.to === form.to)));
    chips($('what-chips'), opts.map((o) => [o.id, o.label]), 'what', form.what);
    $('what-custom').classList.toggle('hidden', form.what !== 'custom');
    $('spouse-only').classList.toggle('hidden', kids);
    $('kids-tip').classList.toggle('hidden', !kids);
    chips($('feel-chips'), Object.keys(VT.script.FEELING).map((id) => [id, FEEL_LABELS[id] || id]), 'feel', form.feeling);
    chips($('help-chips'), Object.keys(VT.script.NEED).map((id) => [id, HELP_LABELS[id] || id]), 'help', form.need, 'pill-act');
    const name = VT.store.setting('spouseName');
    $('text-label').textContent = kids ? 'Say it at eye level' : name ? `Text ${name}` : 'Send as a text';
    if (regenerate) renderScript(false);
  }

  function scriptText() {
    const s = VT.store.settings();
    return VT.script.build({ ...form, name: form.to === 'kids' ? s.kidName : s.spouseName }, form.variant);
  }

  function fit() {
    const el = $('script-output');
    el.style.height = 'auto';
    if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`;
  }

  function setHref() {
    $('text-btn').href = form.to === 'kids' ? '#' : `sms:?&body=${encodeURIComponent($('script-output').value)}`;
  }

  function renderScript(animate = true) {
    const el = $('script-output');
    const text = scriptText();
    form.edited = false;
    const apply = () => {
      el.value = text;
      el.classList.remove('fading');
      fit();
      setHref();
    };
    clearTimeout(timers.fade);
    if (!animate || !el.offsetParent || VT.ui.reducedMotion()) return apply();
    el.classList.add('fading');
    timers.fade = setTimeout(apply, 180);
  }

  function onChip(key, field) {
    return (e) => {
      const b = e.target.closest(`[data-${key}]`);
      if (!b) return;
      form[field] = b.dataset[key];
      form.variant = 0;
      e.currentTarget.querySelectorAll(`[data-${key}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (key === 'what') {
        $('what-custom').classList.toggle('hidden', form.what !== 'custom');
        if (form.what === 'custom') $('what-custom').focus();
      }
      renderScript();
    };
  }

  async function copyScript() {
    const ok = await VT.ui.copy($('script-output').value, $('script-output'));
    if (!ok) return toast('Couldn’t copy automatically. Press and hold the message, then tap Copy.');
    toast(form.to === 'kids' ? 'Copied. Say it at their eye level.' : 'Copied. Send it before the doubt talks you out of it.');
  }

  // ---------- The window ----------
  function setNavLabel(text) {
    $('nav-script').setAttribute('aria-label', text ? `Honest Script, ${text}` : 'Honest Script');
  }

  function renderWindow(slip, victory) {
    const card = $('window-card');
    const now = Date.now();
    let state = 'none';
    if (victory) state = 'done';
    else if (slip) state = now < slip.windowEndsAt ? 'running' : 'closed';
    card.dataset.state = state;

    const ring = $('ring');
    const open = state === 'running' || state === 'closed';
    $('window-dismiss').classList.toggle('hidden', state !== 'closed');
    $('window-undo').classList.toggle('hidden', !open);
    $('window-actions').classList.toggle('hidden', !open);

    if (state === 'none') {
      ring.style.strokeDashoffset = RING;
      $('ring-time').textContent = '15:00';
      $('ring-label').textContent = 'ready';
      $('window-eyebrow').textContent = '15-minute honesty window';
      $('window-title').textContent = 'No window open right now.';
      $('window-body').textContent = 'If a slip happens, tap it on Today and the window starts here on its own. The words below are ready any time.';
      $('window-extra').classList.add('hidden');
      VT.ui.verse($('window-verse'), null);
      return;
    }
    if (state === 'done') {
      const kids = victory.repairs && victory.repairs.kids != null;
      ring.style.strokeDashoffset = 0;
      $('ring-time').textContent = 'Done';
      $('ring-label').textContent = kids ? 'repaired' : 'nothing hidden';
      $('window-eyebrow').textContent = 'Window closed';
      $('window-title').textContent = kids ? 'You made it right.' : 'You didn’t let it become a secret.';
      $('window-body').textContent = 'Take a breath. Then record how it actually went.';
      $('window-extra').classList.add('hidden');
      VT.ui.verse($('window-verse'), null);
      return;
    }
    const copy = VT.insights.moment(state, slip);
    $('window-eyebrow').textContent = copy.eyebrow;
    $('window-title').textContent = copy.title;
    $('window-body').textContent = copy.body;
    $('window-extra').textContent = copy.extra;
    $('window-extra').classList.toggle('hidden', !copy.extra);
    VT.ui.verse($('window-verse'), copy.verse);
    if (state === 'closed') {
      ring.style.strokeDashoffset = RING;
      $('ring-time').textContent = '0:00';
      $('ring-label').textContent = 'still open to you';
    } else tick();
  }

  function tick() {
    if ($('window-card').dataset.state !== 'running') return stopTicker();
    const slip = entryId && VT.store.getLog(entryId);
    if (!slip || slip.disclosed) return stopTicker();
    const left = slip.windowEndsAt - Date.now();
    if (left <= 0) {
      stopTicker();
      return VT.app.render(); // flips to the closed state and refreshes the honesty stats
    }
    $('ring').style.strokeDashoffset = RING * (1 - left / VT.HONESTY_WINDOW_MS);
    $('ring-time').textContent = fmt(left);
    $('ring-label').textContent = 'left';
    $('nav-badge').textContent = fmt(left);
    setNavLabel(`${fmt(left)} left in your window`);
    document.title = `${fmt(left)} · ${VT.kidsFirst(VT.virtueById(slip.virtue)) ? 'Repair' : 'Honesty'} window`;
  }

  function startTicker() {
    if (!ticker) ticker = setInterval(tick, 1000);
    if (!breather) breather = setInterval(breathe, 250);
  }
  function stopTicker() {
    clearInterval(ticker);
    clearInterval(breather);
    ticker = null;
    breather = null;
    document.title = BASE_TITLE;
  }

  // Breathing cue in step with the ring's glow: 4 seconds in, 6 seconds out.
  function breathe() {
    const cue = $('breath-cue');
    const t = (performance.now() / 1000) % 10;
    const text = t < 4 ? 'Breathe in…' : 'Breathe out…';
    if (cue.dataset.text === text) return;
    cue.dataset.text = text;
    cue.style.opacity = '0';
    setTimeout(() => {
      cue.textContent = text;
      cue.style.opacity = '1';
    }, 280);
  }

  // ---------- Prediction, telling, and the double victory ----------
  function renderPredict(slip) {
    $('predict-card').classList.toggle('hidden', !slip);
    if (!slip) return;
    const v = VT.virtueById(slip.virtue);
    const target = repairTarget(v);
    $('predict-label').textContent =
      target === 'kids' ? 'Before you make it right: how hard do you expect it to go?' : `Before you tell ${VT.spouse('your')}: how hard do you expect it to go?`;
    $('told-btn').textContent = VT.REPAIRS[target].action();
  }

  function gapLine(log) {
    const el = $('gap-line');
    if (!actual.touched || !log || log.predicted == null) {
      el.textContent = '';
      return;
    }
    const a = Number($('actual').value);
    const d = log.predicted - a;
    el.textContent =
      `You braced for ${log.predicted}. It was ${a}. ` +
      (d > 0 ? 'Your fear was louder than reality.' : d < 0 ? 'Harder than expected — and you faced it anyway.' : 'You read it right, and still chose the truth.');
  }

  function renderVictory(log) {
    $('victory').classList.toggle('hidden', !log);
    if (!log) return;
    if (actual.id !== log.id) {
      // A new "how did it go?": nothing answered yet.
      actual = { id: log.id, touched: false };
      VT.ui.setSlider('actual', 5);
      $('actual-out').textContent = '–';
      $('victory-hint').classList.add('hidden');
    }
    const copy = VT.insights.moment('celebrate', log);
    $('victory-title').textContent = copy.title;
    $('victory-body').textContent = copy.body;
    VT.ui.verse($('victory-verse'), copy.verse);
    gapLine(log);
  }

  function onTold() {
    flushPredict();
    flushNote();
    const slip = entryId && VT.store.getLog(entryId);
    if (!slip) return VT.app.render();
    const target = repairTarget(VT.virtueById(slip.virtue));
    const now = Date.now();
    const saved = VT.store.updateLog(slip.id, { repairs: { ...slip.repairs, [target]: now }, disclosedAt: slip.disclosedAt || now });
    if (!saved) return toast(VT.ui.SAVE_FAILED);
    victoryId = saved.id;
    focusVictory = true;
    VT.app.render();
  }

  function onVictoryDone() {
    flushNote();
    if (!victoryId) return;
    if (!actual.touched) {
      $('victory-hint').classList.remove('hidden');
      return;
    }
    if (!VT.store.updateLog(victoryId, { actual: Number($('actual').value) })) return toast(VT.ui.SAVE_FAILED);
    victoryId = null;
    VT.app.render();
    toast('Saved. Your Fear vs. Reality graph just grew.');
    location.hash = '#progress';
  }

  function onVictoryLater() {
    flushNote();
    if (!victoryId) return;
    if (!VT.store.updateLog(victoryId, { outcomeSkipped: true })) return toast(VT.ui.SAVE_FAILED);
    victoryId = null;
    VT.app.render();
    toast('Okay. You can add how it went later from Progress → Recent.');
  }

  // ---------- What was underneath (optional, private) ----------
  const activeLogId = () => victoryId || entryId;

  function renderUnderneath(log) {
    $('slip-need-wrap').classList.toggle('hidden', !log);
    if (!log) return;
    const wrap = $('slip-need-chips');
    wrap.innerHTML = '';
    VT.virtueById(log.virtue).needs.forEach((id) => {
      const n = VT.needById(id);
      wrap.appendChild(VT.ui.pill(n.name, { slipNeed: id }, { pressed: log.need === id, hint: n.hint }));
    });
    // Don't overwrite a note that's being typed or is waiting to be saved.
    const typing = document.activeElement === $('slip-note') || (pending.note && pending.note.id === log.id);
    if (!typing) $('slip-note').value = log.note || '';
  }

  function onSlipNeed(e) {
    const b = e.target.closest('[data-slip-need]');
    if (!b) return;
    flushNote();
    const log = VT.store.getLog(activeLogId());
    if (!log) return;
    const need = log.need === b.dataset.slipNeed ? null : b.dataset.slipNeed;
    if (!VT.store.updateLog(log.id, { need })) return toast(VT.ui.SAVE_FAILED);
    VT.app.render();
  }

  // ---------- Public ----------
  VT.honesty = {
    // A slip tapped on Today: log it, start the window, and go straight to the words.
    startSlip(virtueId) {
      if (starting) return; // a double tap must not log two slips
      starting = true;
      setTimeout(() => (starting = false), 800);
      const v = VT.virtueById(virtueId);
      const saved = VT.store.addLog({ date: VT.dates.today(), kind: 'slip', virtue: v.id, note: '', repairsDone: [] });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      if (!v.repairs.length) {
        VT.app.render();
        VT.today.showGrace(saved);
        return;
      }
      flushNote();
      flushPredict();
      seenId = saved.id;
      entryId = saved.id;
      applyDefaults(saved);
      VT.app.render();
      VT.ui.banner(
        'You’re not in trouble.',
        VT.kidsFirst(v) ? 'Opening your repair window — the words are ready.' : 'Opening your honesty window — the words are ready for you.'
      );
      clearTimeout(switchTimer);
      switchTimer = setTimeout(() => (location.hash = '#script'), 650);
    },

    // Save anything typed or moved but not yet stored (the page is being hidden or closed).
    flush() {
      flushNote();
      flushPredict();
    },

    forget(id) {
      dropPending(id);
      if (!id || id === victoryId) victoryId = null;
      if (!id || id === entryId) entryId = null;
    },

    // The tab became visible: size the message box now that it has a width.
    onShow() {
      fit();
    },

    init() {
      // Choosing a tab during the short pause after a slip wins over the automatic switch.
      window.addEventListener('hashchange', () => clearTimeout(switchTimer));
      $('to-seg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-to]');
        if (!b || b.dataset.to === form.to) return;
        form.to = b.dataset.to;
        form.variant = 0;
        renderBuilder();
        renderPredict(entryId && !victoryId ? VT.store.getLog(entryId) : null);
      });
      $('what-chips').addEventListener('click', onChip('what', 'what'));
      $('feel-chips').addEventListener('click', onChip('feel', 'feeling'));
      $('help-chips').addEventListener('click', onChip('help', 'need'));
      $('what-custom').addEventListener('input', () => {
        form.whatCustom = $('what-custom').value;
        renderScript(false);
      });
      $('script-output').addEventListener('input', () => {
        form.edited = true;
        fit();
        setHref();
      });
      $('script-next').addEventListener('click', () => {
        form.variant = (form.variant + 1) % VT.script.count(form.to);
        renderScript();
      });
      $('script-copy').addEventListener('click', copyScript);
      $('text-btn').addEventListener('click', (e) => {
        if (form.to === 'kids') {
          e.preventDefault();
          toast('Get down to their eye level. Short and warm.');
        }
      });

      // The prediction is saved as you go, to the slip it was made for, before the conversation happens.
      $('predict').addEventListener('input', () => {
        if (!entryId) return;
        pending.predict = { id: entryId, value: Number($('predict').value) };
        clearTimeout(timers.predict);
        timers.predict = setTimeout(flushPredict, 400);
      });
      $('told-btn').addEventListener('click', onTold);
      $('actual').addEventListener('input', () => {
        actual.touched = true;
        $('victory-hint').classList.add('hidden');
        gapLine(victoryId && VT.store.getLog(victoryId));
      });
      $('victory-done').addEventListener('click', onVictoryDone);
      $('victory-later').addEventListener('click', onVictoryLater);

      $('window-dismiss').addEventListener('click', () => {
        if (!entryId) return;
        VT.honesty.flush();
        if (!VT.store.updateLog(entryId, { windowDismissed: true })) return toast(VT.ui.SAVE_FAILED);
        entryId = null;
        VT.app.render();
        toast('Okay. You can still make it right from Progress → Recent.');
      });
      $('window-undo').addEventListener('click', () => {
        if (!entryId || !confirm('Remove this slip? Use this if you tapped it by mistake.')) return;
        dropPending(entryId);
        if (!VT.store.deleteLog(entryId)) return toast(VT.ui.SAVE_FAILED);
        entryId = null;
        VT.app.render();
        toast('Removed.');
      });

      $('slip-need-chips').addEventListener('click', onSlipNeed);
      $('slip-note').addEventListener('input', () => {
        const id = activeLogId();
        if (!id) return;
        pending.note = { id, value: $('slip-note').value.trim() };
        clearTimeout(timers.note);
        timers.note = setTimeout(flushNote, 500);
      });
      $('slip-note').addEventListener('blur', flushNote);

      renderBuilder();
    },

    render(ctx) {
      const slip = openEntry(ctx.logs);
      entryId = slip ? slip.id : null;
      if (slip && slip.id !== seenId) {
        seenId = slip.id;
        applyDefaults(slip);
      }
      // Keep the victory on screen until it's answered or set aside; otherwise pick up one left unanswered.
      let victory = victoryId ? ctx.logs.find((l) => l.id === victoryId && l.disclosed && !l.outcomeSkipped) || null : null;
      if (!victory) victory = pendingVictory(ctx.logs);
      victoryId = victory ? victory.id : null;

      renderWindow(victory ? null : slip, victory);
      renderPredict(victory ? null : slip);
      renderVictory(victory);
      renderUnderneath(victory || slip);
      renderBuilder(!form.edited);

      const running = !victory && !!slip && Date.now() < slip.windowEndsAt;
      if (running) startTicker();
      else stopTicker();

      // Nav badge: the countdown while a window runs; a quiet dot while a slip is still carried alone.
      const badge = $('nav-badge');
      const waiting = !running && ctx.honesty.unshared > 0;
      badge.classList.toggle('dot', !running);
      badge.classList.toggle('hidden', !running && !waiting);
      if (!running) {
        badge.textContent = '';
        setNavLabel(waiting ? 'a slip is still waiting to be made right' : '');
      }

      if (focusVictory && victory) {
        focusVictory = false;
        requestAnimationFrame(() => {
          $('victory-title').focus({ preventScroll: true });
          VT.ui.reveal($('victory'));
        });
      }
    },
  };
})();
