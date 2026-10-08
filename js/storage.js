// LocalStorage persistence. One versioned key holds logs, weekly check-ins and settings.
// Older versions (v1 food-only, v2 with honesty fields) are migrated on read.
(function () {
  const KEY = 'virtue-tracker:v1';
  const LIST_MAX = 30; // most good acts / if-then plans kept in settings
  let loadProblem = false; // saved data existed but couldn't be read; a copy was set aside

  const copyAct = (a) => ({ ...a, needs: [...a.needs], virtues: [...a.virtues] });
  const defaultActs = () => VT.DEFAULT_ACTS.map(copyAct);
  const defaultSettings = () => ({
    spouseName: '',
    kidName: '',
    acts: defaultActs(),
    plans: [],
    activeVirtues: [...VT.VIRTUE_IDS],
    lastVirtue: VT.VIRTUE_IDS[0],
    theme: 'auto', // 'auto' follows the phone; 'light' / 'dark' override it
  });
  const empty = () => ({ version: 3, logs: [], weeklies: [], settings: defaultSettings() });

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return sanitize(JSON.parse(raw));
    } catch (err) {
      console.warn('Virtue Tracker: could not read saved data', err);
      // Never let the next save silently replace data we couldn't read: keep the original text aside.
      if (raw) {
        loadProblem = true;
        try {
          localStorage.setItem(`${KEY}:unreadable-${Date.now()}`, raw);
        } catch (e) {
          /* storage full or blocked; nothing more we can do here */
        }
      }
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
  const inRange = (v, lo, hi) => (v !== null && v !== '' && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);
  const score10 = (v) => inRange(v, 1, 10);
  const score5 = (v) => inRange(v, 1, 5);
  const num = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const virtueIds = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => VT.VIRTUE_IDS.includes(id)))] : []);
  const needIds = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => VT.needById(id)))] : []);

  function sanitizeLog(l) {
    const kind = l.kind === 'slip' || l.kind === 'act' ? l.kind : 'urge';
    const isSlip = kind === 'slip';
    const isAct = kind === 'act';
    const virtue = isAct ? null : VT.VIRTUE_IDS.includes(l.virtue) ? l.virtue : 'temperance';
    // Only virtues with a repair step (spouse / kids) have an honesty window.
    const hasWindow = isSlip && VT.virtueById(virtue).repairs.length > 0;

    // Repairs: who a slip was made right with, and when. v2 "disclosed" meant told the spouse.
    let repairs = null;
    if (isSlip) {
      const legacy = !l.repairs || typeof l.repairs !== 'object';
      const r = legacy ? {} : l.repairs;
      repairs = { spouse: num(r.spouse), kids: num(r.kids) };
      // Only migrate records that predate `repairs`; on later writes `disclosed` is derived, not a source.
      if (legacy && l.disclosed) {
        repairs.spouse = num(l.disclosedAt) || Number(l.createdAt) || Date.now();
      }
    }
    const repaired = isSlip && (repairs.spouse != null || repairs.kids != null);
    const createdAt = num(l.createdAt) || Date.now();
    const firstRepair = repaired ? Math.min(...[repairs.spouse, repairs.kids].filter((t) => t != null)) : null;

    return {
      id: String(l.id || VT.uid()),
      date: l.date,
      kind,
      virtue,
      stage: kind === 'urge' ? Number(l.stage) : null,
      need: !isAct && VT.needById(l.need) ? l.need : null,
      note: typeof l.note === 'string' ? l.note.slice(0, 1000) : '',
      createdAt,
      // Slip repair & honesty
      repairs,
      disclosed: repaired,
      disclosedAt: repaired ? num(l.disclosedAt) || firstRepair : null,
      // A window is at most 15 minutes from when the slip was logged (guards against odd imported values).
      windowEndsAt: hasWindow && num(l.windowEndsAt) != null ? Math.min(Math.max(num(l.windowEndsAt), createdAt), createdAt + VT.HONESTY_WINDOW_MS) : null,
      windowDismissed: !!l.windowDismissed,
      outcomeSkipped: isSlip && !!l.outcomeSkipped, // "how did it go?" set aside for later
      predicted: isSlip ? score10(l.predicted) : null,
      actual: isSlip ? score10(l.actual) : null,
      // Good acts
      actId: isAct ? String(l.actId || '') : null,
      label: isAct ? str(l.label, 60) || 'Good act' : null,
      virtues: isAct ? virtueIds(l.virtues) : null,
      status: isAct ? (l.status === 'planned' ? 'planned' : 'done') : null,
      expectLift: isAct ? score5(l.expectLift) : null,
      lift: isAct ? score5(l.lift) : null,
      linkedUrgeId: isAct && l.linkedUrgeId ? String(l.linkedUrgeId) : null,
      planId: isAct && l.planId ? String(l.planId) : null,
      doneAt: isAct ? num(l.doneAt) : null,
    };
  }

  function validLog(l) {
    if (!l || !isDateKey(l.date)) return false;
    if (l.kind === 'slip') return true;
    if (l.kind === 'act') return typeof l.label === 'string' && l.label.trim() !== '';
    return [1, 2, 3, 4].includes(Number(l.stage));
  }

  // v1/v2 check-ins had a single food `friction`; v3 has one per virtue.
  const frictionSource = (w) => (w.frictions && typeof w.frictions === 'object' ? w.frictions : { temperance: w.friction });

  function sanitizeWeekly(w) {
    const src = frictionSource(w);
    const frictions = {};
    for (const id of VT.VIRTUE_IDS) {
      const f = score10(src[id]);
      if (f != null) frictions[id] = f;
    }
    const vals = Object.values(frictions);
    return {
      id: String(w.id || VT.uid()),
      weekOf: w.weekOf,
      frictions,
      friction: VT.round1(vals.reduce((a, b) => a + b, 0) / vals.length),
      energy: w.energy === 'initiation' ? 'initiation' : 'restriction',
      compassion: [0, 1, 2, 3, 4, 5].includes(Number(w.compassion)) ? Number(w.compassion) : 3,
      note: typeof w.note === 'string' ? w.note.slice(0, 2000) : '',
      createdAt: Number(w.createdAt) || Date.now(),
    };
  }

  function validWeekly(w) {
    if (!w || !isDateKey(w.weekOf)) return false;
    const src = frictionSource(w);
    return VT.VIRTUE_IDS.some((id) => score10(src[id]) != null);
  }

  function sanitizeSettings(s) {
    const out = defaultSettings();
    if (!s || typeof s !== 'object') return out;
    out.spouseName = str(s.spouseName, 40);
    out.kidName = str(s.kidName, 40);
    if (Array.isArray(s.acts)) {
      out.acts = s.acts
        .filter((a) => a && str(a.label, 60))
        .slice(0, LIST_MAX)
        .map((a) => ({ id: String(a.id || VT.uid()), label: str(a.label, 60), needs: needIds(a.needs), virtues: virtueIds(a.virtues) }));
    }
    if (Array.isArray(s.plans)) {
      out.plans = s.plans
        .filter((p) => p && str(p.when, 120) && str(p.then, 120))
        .slice(0, LIST_MAX)
        .map((p) => ({
          id: String(p.id || VT.uid()),
          virtue: VT.VIRTUE_IDS.includes(p.virtue) ? p.virtue : VT.VIRTUE_IDS[0],
          when: str(p.when, 120),
          then: str(p.then, 120),
          actId: p.actId ? String(p.actId) : null,
        }));
    }
    const active = virtueIds(s.activeVirtues);
    out.activeVirtues = active.length ? active : [...VT.VIRTUE_IDS];
    out.lastVirtue = out.activeVirtues.includes(s.lastVirtue) ? s.lastVirtue : out.activeVirtues[0];
    out.theme = ['light', 'dark'].includes(s.theme) ? s.theme : 'auto';
    return out;
  }

  function sanitize(data) {
    const out = empty();
    if (!data || typeof data !== 'object') return out;
    if (Array.isArray(data.logs)) {
      // Ids must be unique, or removing one entry would remove its twins too.
      const seen = new Set();
      out.logs = data.logs.filter(validLog).map((l) => {
        const log = sanitizeLog(l);
        if (seen.has(log.id)) log.id = VT.uid() + seen.size;
        seen.add(log.id);
        return log;
      });
    }
    if (Array.isArray(data.weeklies)) out.weeklies = data.weeklies.filter(validWeekly).map(sanitizeWeekly);
    out.settings = sanitizeSettings(data.settings);
    return out;
  }

  // Loaded after the helpers above are defined (consts would be in their TDZ earlier).
  let state = load();

  const byLogOrder = (a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1);
  const byWeekOrder = (a, b) => (a.weekOf === b.weekOf ? a.createdAt - b.createdAt : a.weekOf < b.weekOf ? -1 : 1);
  const copyLog = (l) => ({ ...l, repairs: l.repairs && { ...l.repairs }, virtues: l.virtues && [...l.virtues] });

  VT.store = {
    KEY,
    LIST_MAX,
    // One primitive setting (e.g. spouseName, lastVirtue) without copying the acts and plans lists.
    setting: (key) => state.settings[key],
    logs: () => state.logs.map(copyLog).sort(byLogOrder),
    weeklies: () => state.weeklies.map((w) => ({ ...w, frictions: { ...w.frictions } })).sort(byWeekOrder),
    getLog: (id) => {
      const l = state.logs.find((x) => x.id === id);
      return l ? copyLog(l) : null;
    },
    // state.settings is sanitized on every write, so a deep copy is enough here (this is called on every render).
    settings: () => {
      const s = state.settings;
      return {
        ...s,
        acts: s.acts.map(copyAct),
        plans: s.plans.map((p) => ({ ...p })),
        activeVirtues: [...s.activeVirtues],
      };
    },

    // Urge: { date, kind:'urge', virtue, stage, need, note }
    // Slip: { date, kind:'slip', virtue, need, note, repairsDone: ['spouse'|'kids'], predicted, actual }
    // Act:  { date, kind:'act', actId, label, virtues, status, expectLift, lift, linkedUrgeId, planId, note }
    addLog(input) {
      const now = Date.now();
      const isSlip = input.kind === 'slip';
      const targets = isSlip ? VT.virtueById(input.virtue).repairs : [];
      const repairs = {};
      if (isSlip) (input.repairsDone || []).filter((t) => targets.includes(t)).forEach((t) => (repairs[t] = now));
      const repaired = Object.keys(repairs).length > 0;
      const entry = sanitizeLog({
        ...input,
        id: VT.uid(),
        note: (input.note || '').trim(),
        createdAt: now,
        repairs: isSlip ? repairs : null,
        disclosedAt: repaired ? now : null,
        windowEndsAt: isSlip && !repaired && targets.length ? now + VT.HONESTY_WINDOW_MS : null,
        predicted: isSlip && targets.length ? input.predicted : null,
        actual: isSlip && repaired ? input.actual : null,
        doneAt: input.kind === 'act' && input.status !== 'planned' ? now : null,
      });
      state.logs.push(entry);
      if (save()) return copyLog(entry);
      state.logs.pop(); // keep memory in step with what's actually stored
      return null;
    },
    updateLog(id, patch) {
      const i = state.logs.findIndex((l) => l.id === id);
      if (i < 0) return null;
      const prev = state.logs[i];
      state.logs[i] = sanitizeLog({ ...prev, ...patch });
      if (save()) return copyLog(state.logs[i]);
      state.logs[i] = prev;
      return null;
    },
    deleteLog(id) {
      const prev = state.logs;
      state.logs = state.logs.filter((l) => l.id !== id);
      if (save()) return true;
      state.logs = prev;
      return false;
    },

    addWeekly({ weekOf, frictions, energy, compassion, note }) {
      const entry = sanitizeWeekly({ id: VT.uid(), weekOf, frictions, energy, compassion, note: (note || '').trim(), createdAt: Date.now() });
      if (!Object.keys(entry.frictions).length) return null;
      state.weeklies.push(entry);
      if (save()) return { ...entry, frictions: { ...entry.frictions } };
      state.weeklies.pop();
      return null;
    },

    updateSettings(patch) {
      const prev = state.settings;
      state.settings = sanitizeSettings({ ...prev, ...patch });
      if (save()) return true;
      state.settings = prev;
      return false;
    },

    // Another tab or window saved: pick up its data so this one doesn't overwrite it on the next save.
    reload() {
      state = load();
    },
    // True once if saved data couldn't be read at startup (a copy was kept under another key).
    takeLoadProblem() {
      const p = loadProblem;
      loadProblem = false;
      return p;
    },

    exportJSON: () => JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
    // Throws (leaving saved data untouched) when the file isn't Virtue Tracker data or can't be saved.
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || Array.isArray(data) || !(Array.isArray(data.logs) || Array.isArray(data.weeklies))) {
        throw new Error('Not Virtue Tracker data');
      }
      const prev = state;
      state = sanitize(data);
      if (!save()) {
        state = prev;
        throw new Error('Could not save imported data');
      }
      return { logs: state.logs.length, weeklies: state.weeklies.length };
    },
    clear() {
      const prev = state;
      state = { ...empty(), settings: prev.settings };
      if (save()) return true;
      state = prev;
      return false;
    },
  };
})();
