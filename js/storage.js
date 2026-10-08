// LocalStorage persistence. One versioned key holds both collections.
(function () {
  const KEY = 'virtue-tracker:v1';
  const empty = () => ({ version: 1, logs: [], weeklies: [] });

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

  // Accepts imported or stored data and keeps only well-formed records.
  function sanitize(data) {
    const out = empty();
    if (!data || typeof data !== 'object') return out;
    if (Array.isArray(data.logs)) {
      out.logs = data.logs
        .filter((l) => l && isDateKey(l.date) && [1, 2, 3, 4].includes(Number(l.stage)))
        .map((l) => ({
          id: String(l.id || VT.uid()),
          date: l.date,
          stage: Number(l.stage),
          note: typeof l.note === 'string' ? l.note.slice(0, 1000) : '',
          createdAt: Number(l.createdAt) || Date.now(),
        }));
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
    return out;
  }

  // Loaded after the helpers above are defined (isDateKey is a const and would be in its TDZ earlier).
  let state = load();

  const byLogOrder = (a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1);
  const byWeekOrder = (a, b) => (a.weekOf === b.weekOf ? a.createdAt - b.createdAt : a.weekOf < b.weekOf ? -1 : 1);

  VT.store = {
    logs: () => [...state.logs].sort(byLogOrder),
    weeklies: () => [...state.weeklies].sort(byWeekOrder),

    addLog({ date, stage, note }) {
      const entry = { id: VT.uid(), date, stage: Number(stage), note: note.trim(), createdAt: Date.now() };
      state.logs.push(entry);
      return save() ? entry : null;
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

    exportJSON: () => JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
    importJSON(text) {
      const next = sanitize(JSON.parse(text));
      state = next;
      save();
      return { logs: next.logs.length, weeklies: next.weeklies.length };
    },
    clear() {
      state = empty();
      save();
    },
  };
})();
