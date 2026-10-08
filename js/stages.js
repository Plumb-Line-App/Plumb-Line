// The 4-Stage Scale, needs, and small shared helpers. Loaded first; everything hangs off window.VT.
window.VT = window.VT || {};

// Generic wording: the same path from duty to second nature applies to every virtue.
// Each virtue adds its own concrete example (see virtues.js).
VT.STAGES = [
  {
    id: 1,
    name: 'Heavy Kantian Fight',
    short: 'Heavy fight',
    desc: 'Held the line by sheer force, and it left me drained.',
    color: 'var(--s1)',
  },
  {
    id: 2,
    name: 'Softening Kantian Fight',
    short: 'Softening',
    desc: 'Felt the pull and redirected it — a pause, a delay, a better option. Still effortful.',
    color: 'var(--s2)',
  },
  {
    id: 3,
    name: 'Early Aristotelian Shift',
    short: 'Early shift',
    desc: 'Space appeared on its own between the feeling and the pull. The better choice came easily.',
    color: 'var(--s3)',
  },
  {
    id: 4,
    name: 'Aristotelian Harmony',
    short: 'Harmony',
    desc: 'The pull barely showed up. The right thing was simply what I wanted.',
    color: 'var(--s4)',
  },
];

VT.stageById = (id) => VT.STAGES.find((s) => s.id === Number(id));

// Colours are CSS custom properties so every chart follows the light/dark theme.
// Slips sit outside the stage scale; warm gray keeps them visible without an alarm colour.
VT.SLIP = { name: 'Slip', short: 'Slip', color: 'var(--c-slip)' };

// Good acts: the "doing right" side (mint), set against urges & slips (amber) in the crowding-out chart.
VT.ACT = { name: 'Good act', short: 'Good act', color: 'var(--c-act)' };
VT.FIGHT_COLOR = 'var(--c-urge)';

// What a pull is usually really about. Each virtue offers the needs that fit it,
// and good acts are tagged with the needs they meet.
VT.NEEDS = [
  { id: 'rest', name: 'Rest', hint: 'worn out' },
  { id: 'comfort', name: 'Comfort', hint: 'hurting or heavy' },
  { id: 'connection', name: 'Connection', hint: 'lonely or unseen' },
  { id: 'stimulation', name: 'Stimulation', hint: 'bored or restless' },
  { id: 'reward', name: 'Reward', hint: 'wanting a treat' },
  { id: 'calm', name: 'Calm', hint: 'hurried or overloaded' },
  { id: 'heard', name: 'To be heard', hint: 'ignored or disrespected' },
  { id: 'clarity', name: 'Clarity', hint: 'unsure where to start' },
  { id: 'courage', name: 'Courage', hint: 'afraid it won’t be good enough' },
];
VT.needById = (id) => VT.NEEDS.find((n) => n.id === id) || null;

VT.HONESTY_WINDOW_MS = 15 * 60 * 1000;

// Names used in copy. Saved names win; otherwise neutral wording.
VT.spouse = (pov = 'your') => {
  const name = VT.store && VT.store.setting('spouseName');
  if (name) return name;
  return { my: 'my spouse', your: 'your spouse', them: 'them' }[pov] || 'your spouse';
};
// The saved kid name is a form of address ("buddy") for the repair script only; prose always says "the kids".
VT.kids = () => 'the kids';

VT.LIFT_LABELS = { 1: 'Not at all', 2: 'A little', 3: 'Some', 4: 'A good bit', 5: 'A lot' };

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

VT.plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
VT.round1 = (n) => Math.round(n * 10) / 10;

VT.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
