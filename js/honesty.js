// Honest Script tab: the 15-minute window after a slip, the message builder, the prediction before
// telling, and the double victory after. A slip tapped on Today lands here with the window already running.
(function () {
  const { $, toast } = VT.ui;
  const RING = 2 * Math.PI * 52; // circumference of the ring (r = 52)
  const KEEP_MS = 24 * 60 * 60 * 1000; // a closed window stays here for a day unless dismissed
  const BASE_TITLE = document.title;

  const FEEL_LABELS = { down: 'Down / heavy', stressed: 'Stressed', lonely: 'Lonely', tired: 'Worn out', anxious: 'Anxious', hurried: 'Hurried', numb: 'Numb', unsure: 'Not sure' };
  const HELP_LABELS = { nothing: 'I just don’t want to hide it', listen: 'Just listen', hug: 'A hug', plan: 'Help with a plan' };

  // `edited`: the message was changed by hand, so re-renders leave it alone until a builder choice changes.
  const form = { to: 'spouse', what: 'more', whatCustom: '', feeling: 'down', need: 'nothing', variant: 0, edited: false };
  let entryId = null; // slip whose window is open (running or closed)
  let seenId = null; // last open slip the form was set up for
  let victoryId = null; // slip just made right, waiting for "how did it actually go?"
  let ticker = null;
  const timers = {};
  const later = (key, fn, ms = 400) => {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(fn, ms);
  };

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
    $('slip-note').value = entry.note || '';
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
    if (!animate || !el.offsetParent) return apply();
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
    const text = $('script-output').value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for file:// or older browsers.
      $('script-output').select();
      document.execCommand('copy');
    }
    toast(form.to === 'kids' ? 'Copied. Say it at their eye level.' : 'Copied. Send it before the doubt talks you out of it.');
  }

  // ---------- The window ----------
  function renderWindow(slip, victory) {
    const card = $('window-card');
    const now = Date.now();
    let state = 'none';
    if (victory) state = 'done';
    else if (slip) state = now < slip.windowEndsAt ? 'running' : 'closed';
    card.dataset.state = state;

    const ring = $('ring');
    $('window-dismiss').classList.toggle('hidden', state !== 'closed');
    $('window-undo').classList.toggle('hidden', state !== 'running');
    $('window-actions').classList.toggle('hidden', state !== 'running' && state !== 'closed');

    if (state === 'none') {
      ring.style.strokeDashoffset = RING;
      $('ring-time').textContent = '15:00';
      $('ring-label').textContent = 'ready';
      $('window-eyebrow').textContent = '15-minute honesty window';
      $('window-title').textContent = 'No window open right now.';
      $('window-body').textContent = 'If a slip happens, tap it on Today and the window starts here on its own. The builder below works any time.';
      $('window-extra').classList.add('hidden');
      VT.ui.verse($('window-verse'), null);
      return;
    }
    if (state === 'done') {
      ring.style.strokeDashoffset = 0;
      $('ring-time').textContent = 'Done';
      $('ring-label').textContent = 'nothing hidden';
      $('window-eyebrow').textContent = 'Window closed';
      $('window-title').textContent = 'You didn’t let it become a secret.';
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
    document.title = `${fmt(left)} · ${VT.kidsFirst(VT.virtueById(slip.virtue)) ? 'Repair' : 'Honesty'} window`;
  }

  function startTicker() {
    if (!ticker) ticker = setInterval(tick, 1000);
  }
  function stopTicker() {
    clearInterval(ticker);
    ticker = null;
    document.title = BASE_TITLE;
  }

  // Breathing cue in step with the ring's glow: 4 seconds in, 6 seconds out.
  function breathe() {
    const cue = $('breath-cue');
    if ($('window-card').dataset.state !== 'running') return;
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

  function gapLine(predicted) {
    const a = Number($('actual').value);
    if (predicted == null) {
      $('gap-line').textContent = '';
      return;
    }
    const d = predicted - a;
    $('gap-line').textContent =
      `You braced for ${predicted}. It was ${a}. ` +
      (d > 0 ? 'Your fear was louder than reality.' : d < 0 ? 'Harder than expected — and you faced it anyway.' : 'You read it right, and still chose the truth.');
  }

  function renderVictory(log) {
    $('victory').classList.toggle('hidden', !log);
    if (!log) return;
    const copy = VT.insights.moment('celebrate', log);
    $('victory-title').textContent = copy.title;
    $('victory-body').textContent = copy.body;
    VT.ui.verse($('victory-verse'), copy.verse);
    gapLine(log.predicted);
  }

  function onTold() {
    const slip = entryId && VT.store.getLog(entryId);
    if (!slip) return VT.app.render();
    const v = VT.virtueById(slip.virtue);
    const target = repairTarget(v);
    const now = Date.now();
    const saved = VT.store.updateLog(slip.id, {
      repairs: { ...slip.repairs, [target]: now },
      disclosedAt: slip.disclosedAt || now,
      predicted: Number($('predict').value),
    });
    if (!saved) return toast(VT.ui.SAVE_FAILED);
    clearTimeout(timers.predict);
    victoryId = saved.id;
    VT.ui.setSlider('actual', 5);
    VT.app.render();
    requestAnimationFrame(() => $('victory').scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function saveActual() {
    if (!victoryId) return true;
    return !!VT.store.updateLog(victoryId, { actual: Number($('actual').value) });
  }

  function onVictoryDone() {
    clearTimeout(timers.actual);
    if (!saveActual()) return toast(VT.ui.SAVE_FAILED);
    victoryId = null;
    VT.app.render();
    toast('Saved. Your Fear vs. Reality graph just grew.');
    location.hash = '#progress';
  }

  // ---------- What was underneath (optional, private) ----------
  function renderUnderneath(log) {
    $('slip-need-wrap').classList.toggle('hidden', !log);
    if (!log) return;
    const wrap = $('slip-need-chips');
    wrap.innerHTML = '';
    VT.virtueById(log.virtue).needs.forEach((id) => {
      const n = VT.needById(id);
      wrap.appendChild(VT.ui.pill(n.name, { slipNeed: id }, { pressed: log.need === id, hint: n.hint }));
    });
    if (document.activeElement !== $('slip-note')) $('slip-note').value = log.note || '';
  }

  const activeLogId = () => victoryId || entryId;

  function onSlipNeed(e) {
    const b = e.target.closest('[data-slip-need]');
    const log = b && VT.store.getLog(activeLogId());
    if (!log) return;
    const need = log.need === b.dataset.slipNeed ? null : b.dataset.slipNeed;
    if (!VT.store.updateLog(log.id, { need })) return toast(VT.ui.SAVE_FAILED);
    VT.app.render();
  }

  // ---------- Public ----------
  VT.honesty = {
    // A slip tapped on Today: log it, start the window, and go straight to the words.
    startSlip(virtueId) {
      const v = VT.virtueById(virtueId);
      const saved = VT.store.addLog({ date: VT.dates.today(), kind: 'slip', virtue: v.id, note: '', repairsDone: [] });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      if (!v.repairs.length) {
        VT.app.render();
        VT.today.showGrace(saved);
        return;
      }
      victoryId = null;
      seenId = saved.id;
      entryId = saved.id;
      applyDefaults(saved);
      VT.app.render();
      VT.ui.banner(
        'You’re not in trouble.',
        VT.kidsFirst(v) ? 'Opening your repair window — the words are ready.' : 'Opening your honesty window — the words are ready for you.'
      );
      setTimeout(() => (location.hash = '#script'), 650);
    },

    forget(id) {
      if (!id || id === victoryId) victoryId = null;
      if (!id || id === entryId) entryId = null;
    },

    // The tab became visible: size the message box now that it has a width.
    onShow() {
      fit();
    },

    init() {
      $('to-seg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-to]');
        if (!b || b.dataset.to === form.to) return;
        form.to = b.dataset.to;
        form.variant = 0;
        renderBuilder();
        const slip = entryId && VT.store.getLog(entryId);
        renderPredict(slip);
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

      $('predict').addEventListener('input', () =>
        later('predict', () => {
          // Saved as you go, so the prediction is on record before the conversation happens.
          if (entryId) VT.store.updateLog(entryId, { predicted: Number($('predict').value) });
        })
      );
      $('told-btn').addEventListener('click', onTold);
      $('actual').addEventListener('input', () => {
        const log = victoryId && VT.store.getLog(victoryId);
        gapLine(log ? log.predicted : null);
        later('actual', saveActual);
      });
      $('victory-done').addEventListener('click', onVictoryDone);

      $('window-dismiss').addEventListener('click', () => {
        if (!entryId) return;
        if (!VT.store.updateLog(entryId, { windowDismissed: true })) return toast(VT.ui.SAVE_FAILED);
        entryId = null;
        VT.app.render();
        toast('Okay. You can still make it right from Progress → Recent.');
      });
      $('window-undo').addEventListener('click', () => {
        if (!entryId || !confirm('Remove this slip? Use this if you tapped it by mistake.')) return;
        if (!VT.store.deleteLog(entryId)) return toast(VT.ui.SAVE_FAILED);
        entryId = null;
        VT.app.render();
        toast('Removed.');
      });

      $('slip-need-chips').addEventListener('click', onSlipNeed);
      $('slip-note').addEventListener('input', () =>
        later('note', () => {
          const id = activeLogId();
          if (id && !VT.store.updateLog(id, { note: $('slip-note').value.trim() })) toast(VT.ui.SAVE_FAILED);
        })
      );

      setInterval(breathe, 250);
      renderBuilder();
    },

    render(ctx) {
      const slip = openEntry(ctx.logs);
      entryId = slip ? slip.id : null;
      if (slip && slip.id !== seenId) {
        seenId = slip.id;
        applyDefaults(slip);
      }
      const victory = victoryId ? ctx.logs.find((l) => l.id === victoryId) || null : null;
      if (!victory) victoryId = null;

      renderWindow(victory ? null : slip, victory);
      renderPredict(victory ? null : slip);
      renderVictory(victory);
      renderUnderneath(victory || slip);
      renderBuilder(!form.edited);

      const running = slip && Date.now() < slip.windowEndsAt;
      if (running) startTicker();
      else stopTicker();

      // Nav badge: the countdown while a window runs; a quiet dot while a slip is still carried alone.
      const badge = $('nav-badge');
      badge.classList.toggle('dot', !running);
      badge.classList.toggle('hidden', !running && !(ctx.honesty.unshared > 0));
      if (!running) badge.textContent = '';
    },
  };
})();
