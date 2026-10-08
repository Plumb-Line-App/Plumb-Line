// Small DOM helpers shared by the tab controllers.
(function () {
  const $ = (id) => document.getElementById(id);
  const RATE_HINTS = { 1: 'Not at all', 3: 'Some', 5: 'A lot' };
  let toastTimer;

  VT.ui = {
    $,
    SAVE_FAILED: 'This didn’t save — browser storage may be full or blocked. What you wrote still matters; try Export to keep a copy.',

    toast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
    },

    setSlider(id, value) {
      const el = $(id);
      el.value = value;
      if (el.dataset.out) $(el.dataset.out).textContent = el.value;
    },

    // 1–5 "how much did it help" buttons.
    buildRate(el, selected = null) {
      el.innerHTML = '';
      for (let i = 1; i <= 5; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rate-btn';
        b.dataset.rate = String(i);
        b.setAttribute('aria-pressed', String(i === selected));
        b.setAttribute('aria-label', `${i} — ${VT.LIFT_LABELS[i]}`);
        b.innerHTML = `<b>${i}</b><small>${RATE_HINTS[i] || '&nbsp;'}</small>`;
        el.appendChild(b);
      }
    },
    setRate(el, value) {
      el.querySelectorAll('[data-rate]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === value)));
    },

    // Show a verse in a <figure>, or hide the figure when there's none.
    verse(el, ref) {
      if (!el) return;
      if (!ref || !VT.scripture.text(ref)) {
        el.innerHTML = '';
        el.classList.add('hidden');
        return;
      }
      el.classList.remove('hidden');
      if (el.dataset.ref !== ref || !el.firstChild) VT.scripture.render(el, ref);
    },

    // A pill button. `attrs` become data-* attributes.
    pill(label, data = {}, { pressed = null, cls = '', hint = '' } = {}) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pill ${cls}`.trim();
      Object.entries(data).forEach(([k, v]) => (b.dataset[k] = v));
      if (pressed != null) b.setAttribute('aria-pressed', String(pressed));
      const span = document.createElement('span');
      span.textContent = label;
      b.appendChild(span);
      if (hint) {
        const h = document.createElement('span');
        h.className = 'pill-hint';
        h.textContent = hint;
        b.appendChild(h);
      }
      return b;
    },

    // <dialog> with a fallback for browsers without showModal().
    openDialog(el) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    },
    closeDialog(el) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    },

    // Soft top banner for moments that need words, not a toast (slip intercept, fresh start).
    banner(title, body, ms = 4200, tone = '') {
      const el = $('banner');
      el.dataset.tone = tone;
      $('banner-title').textContent = title;
      $('banner-body').textContent = body;
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show'), ms);
    },

    clampPct: (score) => (score == null ? 0 : Math.max(2, Math.min(98, score))),

    reducedMotion: () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
    // Bring an element into view (clear of the floating nav, via scroll-padding), gently unless motion is reduced.
    reveal(el, block = 'nearest') {
      if (el) el.scrollIntoView({ behavior: VT.ui.reducedMotion() ? 'auto' : 'smooth', block });
    },
    // Copy text; true if it worked. iOS needs a real selection range for the fallback.
    async copy(text, field) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        if (!field) return false;
        field.focus();
        field.setSelectionRange(0, field.value.length);
        let ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (err) {
          ok = false;
        }
        field.blur();
        return ok;
      }
    },
  };
})();
