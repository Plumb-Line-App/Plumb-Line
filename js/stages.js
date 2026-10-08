// The 4-Stage Scale and small shared helpers. Loaded first; everything hangs off window.VT.
window.VT = window.VT || {};

VT.STAGES = [
  {
    id: 1,
    name: 'Heavy Kantian Fight',
    short: 'Heavy fight',
    desc: 'Held the line on raw willpower, but left feeling depleted and deprived.',
    color: '#9aa8b8',
  },
  {
    id: 2,
    name: 'Softening Kantian Fight',
    short: 'Softening',
    desc: 'Urge hit; I introduced a constructive delay or alternative. High effort, lower friction.',
    color: '#6f9bb5',
  },
  {
    id: 3,
    name: 'Early Aristotelian Shift',
    short: 'Early shift',
    desc: 'Natural space appeared between the mood and the urge. Easily chose another way to care for myself.',
    color: '#7fae9a',
  },
  {
    id: 4,
    name: 'Aristotelian Harmony',
    short: 'Harmony',
    desc: 'Food in its proper place as nourishment. The heavy mood didn’t trigger a default craving.',
    color: '#4f8a72',
  },
];

VT.stageById = (id) => VT.STAGES.find((s) => s.id === Number(id));

VT.COMPASSION_LABELS = {
  0: 'No notable slips',
  1: 'Heavy guilt and shame',
  2: 'Mostly self-critical',
  3: 'Mixed',
  4: 'Mostly understanding',
  5: 'Gentle curiosity',
};

// Local-time date helpers (YYYY-MM-DD) so "today" matches the user's wall clock, not UTC.
VT.dates = {
  toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  today() {
    return VT.dates.toKey(new Date());
  },
  parse(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  addDays(key, n) {
    const d = VT.dates.parse(key);
    d.setDate(d.getDate() + n);
    return VT.dates.toKey(d);
  },
  daysBetween(a, b) {
    return Math.round((VT.dates.parse(b) - VT.dates.parse(a)) / 86400000);
  },
  // Monday of the week containing `key`.
  weekStart(key) {
    const d = VT.dates.parse(key);
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return VT.dates.toKey(d);
  },
  pretty(key, opts = { month: 'short', day: 'numeric' }) {
    return VT.dates.parse(key).toLocaleDateString(undefined, opts);
  },
};

VT.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
