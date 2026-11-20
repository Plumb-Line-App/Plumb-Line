// Coaching UI: becoming a husband she is safe with. Today (pillar, practice, the weekly question to ask her,
// tonight's review), Coach playbooks, the Progress view of the pillars, and the pillars in Foundations.
(function () {
  const { $, toast } = VT.ui;
  const MYSELF_KEY = 'plumb-line:myself-open';
  const PLAYBOOK_PREFIX = 'playbook:';

  let practiceOffset = 0; // "Show me another" moves through today's pillar
  let offsetDate = '';
  let reviewToward = null;
  let editingReview = false;
  let editingAnswer = false;

  const today = () => VT.dates.today();
  const pillarNow = () => VT.pillarById(VT.store.setting('pillar'));
  const isDaily = (e) => e.type === 'practice' && !e.practiceId.startsWith(PLAYBOOK_PREFIX);
  const thisWeek = (e) => VT.dates.weekStart(e.date) === VT.dates.weekStart(today());

  // ---------- Today: pillar and practice ----------
  function renderPractice(journal, s) {
    const p = VT.pillarById(s.pillar);
    const days = VT.coach.daysIn(s.pillarSince);
    $('pillar-eyebrow').textContent = `Pillar ${p.id} of 5 · ${p.name} · Day ${days}`;
    $('pillar-her').textContent = `“${p.herView}”`;

    if (offsetDate !== today()) {
      offsetDate = today();
      practiceOffset = 0;
    }
    const done = journal.find((e) => isDaily(e) && e.date === today());
    const practice = done ? { text: done.text } : VT.coach.practiceFor(p.id, today(), practiceOffset);
    $('practice-text').textContent = practice.text;
    $('practice-actions').classList.toggle('hidden', !!done);
    $('practice-status').classList.toggle('hidden', !done);
    $('practice-undo').dataset.id = done ? done.id : '';

    // Last night's "tomorrow's one thing", carried into today.
    const last = [...journal].reverse().find((e) => e.type === 'review' && e.date < today() && e.tomorrow);
    const plan = $('yesterday-plan');
    const recent = last && VT.dates.daysBetween(last.date, today()) <= 2;
    plan.classList.toggle('hidden', !recent);
    if (recent) plan.textContent = `You planned: “${last.tomorrow}”`;
  }

  function onPracticeDone() {
    const p = pillarNow();
    const practice = VT.coach.practiceFor(p.id, today(), practiceOffset);
    const saved = VT.store.addEntry({ date: today(), type: 'practice', pillar: p.id, practiceId: practice.id, text: practice.text });
    if (!saved) return toast(VT.ui.SAVE_FAILED);
    VT.app.render();
    toast('Done. Small, repeated, and she feels it.');
  }

  // ---------- Today: this week's question ----------
  function renderAsk(journal, s) {
    const q = VT.coach.questionFor(s.pillar);
    $('ask-question').textContent = q.text;
    $('ask-rules').textContent = VT.QUESTION_RULES;
    const answer = [...journal].reverse().find((e) => e.type === 'answer' && thisWeek(e));
    const showSaved = !!answer && !editingAnswer;
    $('ask-form').classList.toggle('hidden', showSaved);
    $('ask-saved').classList.toggle('hidden', !showSaved);
    if (answer) {
      $('ask-saved-text').textContent = answer.said;
      // The question that was actually asked stays with the answer, even if the pillar has changed since.
      $('ask-question').textContent = answer.question || q.text;
    }
    // Never clear a half-typed answer on a re-render; only fill it from what was saved.
    if (answer && !editingAnswer && document.activeElement !== $('ask-said')) $('ask-said').value = answer.said;
  }

  function onAskSave() {
    const said = $('ask-said').value.trim();
    if (!said) return toast('Write down what she said first, even a few words.');
    const journal = VT.store.journal();
    const answer = [...journal].reverse().find((e) => e.type === 'answer' && thisWeek(e));
    const p = pillarNow();
    const q = answer ? { id: answer.questionId, text: answer.question } : VT.coach.questionFor(p.id);
    const saved = answer
      ? VT.store.updateEntry(answer.id, { said })
      : VT.store.addEntry({ date: today(), type: 'answer', pillar: p.id, questionId: q.id, question: q.text, said });
    if (!saved) return toast(VT.ui.SAVE_FAILED);
    editingAnswer = false;
    VT.app.render();
    toast('Saved. Thank her for telling you.');
  }

  // ---------- Today: tonight's review ----------
  const TOWARD = { yes: 'Yes', mostly: 'Mostly', no: 'Not today' };

  function renderReview(journal) {
    const review = journal.find((e) => e.type === 'review' && e.date === today());
    const showSaved = !!review && !editingReview;
    $('review-form').classList.toggle('hidden', showSaved);
    $('review-saved').classList.toggle('hidden', !showSaved);
    if (showSaved) {
      $('review-saved-head').textContent = 'Tonight’s review is saved.';
      const list = $('review-saved-list');
      list.innerHTML = '';
      [
        ['Turned toward her', review.toward ? TOWARD[review.toward] : ''],
        ['Went well', review.well],
        ['Do differently', review.better],
        ['Tomorrow', review.tomorrow],
      ].forEach(([k, v]) => {
        if (!v) return;
        const div = document.createElement('div');
        div.innerHTML = '<dt class="text-xs text-dim"></dt><dd class="break-words"></dd>';
        div.firstChild.textContent = k;
        div.lastChild.textContent = v;
        list.appendChild(div);
      });
    }
    $('review-toward').querySelectorAll('[data-toward]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.toward === reviewToward)));
  }

  function fillReview(review) {
    reviewToward = review ? review.toward : null;
    $('review-well').value = review ? review.well : '';
    $('review-better').value = review ? review.better : '';
    $('review-tomorrow').value = review ? review.tomorrow : '';
  }

  function onReviewSave() {
    const fields = { toward: reviewToward, well: $('review-well').value.trim(), better: $('review-better').value.trim(), tomorrow: $('review-tomorrow').value.trim() };
    if (!fields.toward && !fields.well && !fields.better && !fields.tomorrow) return $('review-error').classList.remove('hidden');
    $('review-error').classList.add('hidden');
    const existing = VT.store.journal().find((e) => e.type === 'review' && e.date === today());
    const saved = existing
      ? VT.store.updateEntry(existing.id, fields)
      : VT.store.addEntry({ date: today(), type: 'review', pillar: pillarNow().id, ...fields });
    if (!saved) return toast(VT.ui.SAVE_FAILED);
    editingReview = false;
    fillReview(null); // tomorrow's form starts empty; Edit refills it from what was saved
    VT.app.render();
    toast('Saved. Rest well.');
  }

  // ---------- Today: Myself (the habits tracker) ----------
  function setMyself(open, remember = true) {
    $('myself').hidden = !open;
    $('myself-toggle').textContent = open ? 'Close' : 'Open';
    $('myself-toggle').setAttribute('aria-expanded', String(open));
    if (remember) {
      try {
        localStorage.setItem(MYSELF_KEY, open ? '1' : '0');
      } catch (e) {
        /* private mode: the choice just isn't remembered */
      }
    }
  }

  // ---------- Coach: playbooks ----------
  function buildPlaybooks() {
    const list = $('playbooks');
    list.innerHTML = '';
    VT.PLAYBOOKS.forEach((pb, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <details class="playbook">
          <summary><span class="playbook-icon" aria-hidden="true"></span><span data-f="title"></span></summary>
          <div class="playbook-body">
            <ol class="playbook-steps"></ol>
            <p class="playbook-say"></p>
            <p class="playbook-avoid"><b>Avoid:</b> <span data-f="avoid"></span></p>
            <figure class="verse-box"></figure>
            <div class="flex flex-wrap gap-2" data-f="actions"></div>
          </div>
        </details>`;
      li.querySelector('.playbook-icon').textContent = String(i + 1);
      li.querySelector('[data-f="title"]').textContent = pb.title;
      const steps = li.querySelector('.playbook-steps');
      pb.steps.forEach((t) => {
        const step = document.createElement('li');
        step.textContent = t;
        steps.appendChild(step);
      });
      li.querySelector('.playbook-say').textContent = pb.say;
      li.querySelector('[data-f="avoid"]').textContent = pb.avoid;
      VT.ui.verse(li.querySelector('figure'), pb.verse);
      const actions = li.querySelector('[data-f="actions"]');
      if (pb.done) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-mint btn-sm';
        b.dataset.playbookDone = pb.id;
        b.textContent = pb.done;
        actions.appendChild(b);
      }
      if (pb.words) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-ghost btn-sm';
        b.dataset.playbookWords = pb.id;
        b.textContent = 'Open the words';
        actions.appendChild(b);
      }
      if (!actions.children.length) actions.remove();
      list.appendChild(li);
    });
  }

  function onPlaybookClick(e) {
    const done = e.target.closest('[data-playbook-done]');
    if (done) {
      const pb = VT.PLAYBOOKS.find((x) => x.id === done.dataset.playbookDone);
      const saved = VT.store.addEntry({ date: today(), type: 'practice', pillar: 1, practiceId: PLAYBOOK_PREFIX + pb.id, text: 'Made it right after snapping at her' });
      if (!saved) return toast(VT.ui.SAVE_FAILED);
      VT.app.render();
      return toast('That’s the repair. It’s what she’ll remember.');
    }
    if (e.target.closest('[data-playbook-words]')) VT.ui.reveal($('make-right'), 'start');
  }

  // ---------- Progress ----------
  function renderProgress(journal, s) {
    const p = VT.pillarById(s.pillar);
    const days = VT.coach.daysIn(s.pillarSince);
    $('pp-title').textContent = `Pillar ${p.id} · ${p.name}`;
    $('pp-why').textContent = p.why;

    const steps = $('pp-steps');
    steps.innerHTML = '';
    VT.PILLARS.forEach((x) => {
      const li = document.createElement('li');
      li.className = `pillar-step${x.id < p.id ? ' done' : ''}${x.id === p.id ? ' current' : ''}`;
      if (x.id === p.id) li.setAttribute('aria-current', 'step');
      const count = journal.filter((e) => e.type === 'practice' && e.pillar === x.id).length;
      li.innerHTML = '<span class="n"></span><span class="name"></span><span class="count"></span>';
      li.querySelector('.n').textContent = String(x.id);
      li.querySelector('.name').textContent = x.name;
      li.querySelector('.count').textContent = count ? VT.plural(count, 'practice') : '';
      steps.appendChild(li);
    });

    const since = VT.dates.addDays(today(), -29);
    const recent = journal.filter((e) => e.date >= since);
    const reviews = recent.filter((e) => e.type === 'review');
    const toward = reviews.filter((e) => e.toward === 'yes').length;
    $('pp-practices').textContent = recent.filter((e) => e.type === 'practice').length;
    $('pp-reviews').textContent = reviews.length;
    $('pp-toward').textContent = reviews.length ? `${toward}/${reviews.length}` : '—';

    const next = VT.PILLARS.find((x) => x.id === p.id + 1);
    const prev = VT.PILLARS.find((x) => x.id === p.id - 1);
    $('pp-advice').textContent = next
      ? `Day ${days} of ${p.name}. Move on when the practice feels more natural than forced, usually about two weeks. The earlier pillars stay with you; this only changes the daily practice.`
      : `Day ${days} of ${p.name}, the last pillar. Keep practicing all five. Next comes teaching your son what you’ve learned, mostly by letting him watch.`;
    $('pp-next').classList.toggle('hidden', !next);
    if (next) $('pp-next').textContent = `Move to pillar ${next.id}: ${next.name} →`;
    $('pp-back').classList.toggle('hidden', !prev);
    if (prev) $('pp-back').textContent = `Go back to ${prev.name}`;

    list($('answers-list'), $('answers-empty'), [...journal].reverse().filter((e) => e.type === 'answer'), (e, li) => {
      li.innerHTML = '<p class="text-xs text-dim" data-f="when"></p><p class="text-sm text-mist mt-1" data-f="q"></p><p class="mt-1 break-words" data-f="said"></p>';
      li.querySelector('[data-f="when"]').textContent = `Week of ${VT.dates.pretty(VT.dates.weekStart(e.date))}`;
      li.querySelector('[data-f="q"]').textContent = e.question;
      li.querySelector('[data-f="said"]').textContent = `“${e.said}”`;
    });
    list($('moments-list'), $('moments-empty'), [...journal].reverse().filter((e) => e.type === 'review' && e.well).slice(0, 12), (e, li) => {
      li.innerHTML = '<p class="text-xs text-dim"></p><p class="mt-1 break-words"></p>';
      li.firstChild.textContent = VT.dates.pretty(e.date, { weekday: 'short', month: 'short', day: 'numeric' });
      li.lastChild.textContent = e.well;
    });
  }

  function list(ul, emptyEl, items, fill) {
    ul.innerHTML = '';
    emptyEl.classList.toggle('hidden', items.length > 0);
    items.forEach((e) => {
      const li = document.createElement('li');
      li.className = 'py-3';
      fill(e, li);
      ul.appendChild(li);
    });
  }

  function movePillar(step) {
    const p = pillarNow();
    const to = VT.pillarById(p.id + step);
    if (to.id === p.id) return;
    const msg = step > 0
      ? `Move to pillar ${to.id}, ${to.name}? ${p.name} stays with you; this changes the daily practice and the weekly question.`
      : `Go back to pillar ${to.id}, ${to.name}? Going back is wise when the ground feels shaky.`;
    if (!confirm(msg)) return;
    if (!VT.store.updateSettings({ pillar: to.id, pillarSince: today() })) return toast(VT.ui.SAVE_FAILED);
    practiceOffset = 0;
    VT.app.render();
    toast(`Pillar ${to.id}: ${to.name}. “${to.herView}”`);
  }

  // ---------- Foundations ----------
  function buildPillarsExplained() {
    const ol = $('pillars-explained');
    ol.innerHTML = '';
    VT.PILLARS.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'pillar-item';
      li.innerHTML = '<p class="eyebrow"></p><p class="her"></p><p class="text-sm mt-2 leading-relaxed" data-f="summary"></p><p class="text-sm text-mist mt-2 leading-relaxed" data-f="why"></p><figure class="mt-3"></figure>';
      li.querySelector('.eyebrow').textContent = `${p.id} · ${p.name}`;
      li.querySelector('.her').textContent = `“${p.herView}”`;
      li.querySelector('[data-f="summary"]').textContent = p.summary;
      li.querySelector('[data-f="why"]').textContent = p.why;
      VT.ui.verse(li.querySelector('figure'), p.verse);
      ol.appendChild(li);
    });
  }

  VT.husband = {
    init() {
      if (!VT.store.setting('pillarSince')) VT.store.updateSettings({ pillarSince: today() });
      let open = false;
      try {
        open = localStorage.getItem(MYSELF_KEY) === '1';
      } catch (e) {
        /* private mode */
      }
      setMyself(open, false);
      $('myself-toggle').addEventListener('click', () => setMyself($('myself').hidden));

      $('practice-done').addEventListener('click', onPracticeDone);
      $('practice-another').addEventListener('click', () => {
        practiceOffset++;
        VT.app.render();
      });
      $('practice-undo').addEventListener('click', () => {
        const id = $('practice-undo').dataset.id;
        if (id && !VT.store.deleteEntry(id)) return toast(VT.ui.SAVE_FAILED);
        VT.app.render();
      });

      $('ask-save').addEventListener('click', onAskSave);
      $('ask-edit').addEventListener('click', () => {
        editingAnswer = true;
        VT.app.render();
        $('ask-said').focus();
      });

      $('review-toward').addEventListener('click', (e) => {
        const b = e.target.closest('[data-toward]');
        if (!b) return;
        reviewToward = reviewToward === b.dataset.toward ? null : b.dataset.toward;
        $('review-error').classList.add('hidden');
        renderReview(VT.store.journal());
      });
      $('review-save').addEventListener('click', onReviewSave);
      $('review-edit').addEventListener('click', () => {
        editingReview = true;
        fillReview(VT.store.journal().find((e) => e.type === 'review' && e.date === today()));
        VT.app.render();
        $('review-well').focus();
      });

      buildPlaybooks();
      $('playbooks').addEventListener('click', onPlaybookClick);
      $('pp-next').addEventListener('click', () => movePillar(1));
      $('pp-back').addEventListener('click', () => movePillar(-1));
      buildPillarsExplained();
    },

    // Data was replaced (import / clear): drop anything in progress.
    forget() {
      editingReview = false;
      editingAnswer = false;
      fillReview(null);
    },

    render(ctx) {
      const journal = VT.store.journal();
      renderPractice(journal, ctx.settings);
      renderAsk(journal, ctx.settings);
      renderReview(journal);
      renderProgress(journal, ctx.settings);
      // Coach: while a window or "how did it go?" is open, Make it right comes first.
      $('coach-body').dataset.active = $('window-card').dataset.state === 'none' ? '' : '1';
    },
  };
})();
