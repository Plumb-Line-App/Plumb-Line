// LocalStorage persistence. One versioned key holds logs, weekly check-ins and settings.
(function () {
  const KEY = 'virtue-tracker:v1';
  const empty = () => ({ version: 2, logs: [], weeklies: [], settings: { spouseName: '' } });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return sanitize(JSON.parse(raw));
    } catch (err) {
      console.warn('Virtue Tracker: could not read saved data', err);
      return empty();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('Virtue Tracker: could not save', err);
      return false;
    }
  }

  const isDateKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const score10 = (v) => (Number(v) >= 1 && Number(v) <= 10 ? Number(v) : null);
  const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

  function sanitizeLog(l) {
    const kind = l.kind === 'slip' ? 'slip' : 'urge';
    return {
      id: String(l.id || VT.uid()),
      date: l.date,
      kind,
      stage: kind === 'urge' ? Number(l.stage) : null,
      note: typeof l.note === 'string' ? l.note.slice(0, 1000) : '',
      createdAt: Number(l.createdAt) || Date.now(),
      // Honesty fields (slips only)
      disclosed: kind === 'slip' && !!l.disclosed,
      disclosedAt: kind === 'slip' ? num(l.disclosedAt) : null,
      windowEndsAt: kind === 'slip' ? num(l.windowEndsAt) : null,
      windowDismissed: !!l.windowDismissed,
      predicted: kind === 'slip' ? score10(l.predicted) : null,
      actual: kind === 'slip' ? score10(l.actual) : null,
    };
  }

  // Accepts imported or stored data (v1 or v2) and keeps only well-formed records.
  function sanitize(data) {
    const out = empty();
    if (!data || typeof data !== 'object') return out;
    if (Array.isArray(data.logs)) {
      out.logs = data.logs
        .filter((l) => l && isDateKey(l.date) && (l.kind === 'slip' || [1, 2, 3, 4].includes(Number(l.stage))))
        .map(sanitizeLog);
    }
    if (Array.isArray(data.weeklies)) {
      out.weeklies = data.weeklies
        .filter((w) => w && isDateKey(w.weekOf) && Number(w.friction) >= 1 && Number(w.friction) <= 10)
        .map((w) => ({
          id: String(w.id || VT.uid()),
          weekOf: w.weekOf,
          friction: Number(w.friction),
          energy: w.energy === 'initiation' ? 'initiation' : 'restriction',
          compassion: [0, 1, 2, 3, 4, 5].includes(Number(w.compassion)) ? Number(w.compassion) : 3,
          note: typeof w.note === 'string' ? w.note.slice(0, 2000) : '',
          createdAt: Number(w.createdAt) || Date.now(),
        }));
    }
    if (data.settings && typeof data.settings.spouseName === 'string') {
      out.settings.spouseName = data.settings.spouseName.trim().slice(0, 40);
    }
    return out;
  }

  // Loaded after the helpers above are defined (isDateKey is a const and would be in its TDZ earlier).
  let state = load();

  const byLogOrder = (a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1);
  const byWeekOrder = (a, b) => (a.weekOf === b.weekOf ? a.createdAt - b.createdAt : a.weekOf < b.weekOf ? -1 : 1);

  VT.store = {
    logs: () => [...state.logs].sort(byLogOrder),
    weeklies: () => [...state.weeklies].sort(byWeekOrder),
    getLog: (id) => state.logs.find((l) => l.id === id) || null,
    settings: () => ({ ...state.settings }),

    // Urge: { date, kind:'urge', stage, note }. Slip: { date, kind:'slip', note, disclosed, predicted, actual }.
    addLog(input) {
      const now = Date.now();
      const isSlip = input.kind === 'slip';
      const entry = sanitizeLog({
        ...input,
        id: VT.uid(),
        note: (input.note || '').trim(),
        createdAt: now,
        disclosedAt: isSlip && input.disclosed ? now : null,
        windowEndsAt: isSlip && !input.disclosed ? now + VT.HONESTY_WINDOW_MS : null,
        actual: isSlip && input.disclosed ? input.actual : null,
      });
      state.logs.push(entry);
      return save() ? entry : null;
    },
    updateLog(id, patch) {
      const i = state.logs.findIndex((l) => l.id === id);
      if (i < 0) return null;
      state.logs[i] = sanitizeLog({ ...state.logs[i], ...patch });
      return save() ? state.logs[i] : null;
    },
    deleteLog(id) {
      state.logs = state.logs.filter((l) => l.id !== id);
      save();
    },

    addWeekly({ weekOf, friction, energy, compassion, note }) {
      const entry = {
        id: VT.uid(),
        weekOf,
        friction: Number(friction),
        energy,
        compassion: Number(compassion),
        note: note.trim(),
        createdAt: Date.now(),
      };
      state.weeklies.push(entry);
      return save() ? entry : null;
    },

    setSpouseName(name) {
      state.settings.spouseName = String(name || '').trim().slice(0, 40);
      save();
    },

    exportJSON: () => JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
    importJSON(text) {
      const next = sanitize(JSON.parse(text));
      state = next;
      save();
      return { logs: next.logs.length, weeklies: next.weeklies.length };
    },
    clear() {
      const keep = state.settings;
      state = empty();
      state.settings = keep;
      save();
    },
  };
})();
