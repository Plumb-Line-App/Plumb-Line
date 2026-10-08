// Eight weeks of realistic sample data (no real names), as an importable JSON string. Runs inside the page.
module.exports = () => {
  const today = VT.dates.today();
  const logs = [];
  let t = Date.now() - 56 * 86400000;
  const add = (o) => logs.push({ id: VT.uid() + logs.length, createdAt: (t += 3600000), ...o });
  for (let d = 55; d >= 0; d--) {
    const date = VT.dates.addDays(today, -d);
    const prog = (55 - d) / 55;
    if (d % 2 === 0) add({ date, kind: 'act', actId: 'walk', label: 'Went for a walk', virtues: ['temperance', 'patience'], status: 'done', lift: 4 + (d % 3 === 0 ? 1 : 0) });
    if (d % 3 === 0 && prog > 0.3) add({ date, kind: 'act', actId: 'kids', label: 'Played with the kids', virtues: ['patience'], status: 'done', lift: 5, expectLift: 3 });
    if (d % 4 === 1) add({ date, kind: 'act', actId: 'first10', label: 'Did the first 10 minutes', virtues: ['diligence'], status: 'done', lift: 4 });
    if (d % 3 === 1) add({ date, kind: 'urge', virtue: 'temperance', stage: Math.min(4, 1 + Math.round(prog * 2.6 + (d % 2))), need: ['rest', 'comfort', 'connection'][d % 3], note: d === 1 ? 'Rough afternoon; paused and went outside instead.' : '' });
    if (d % 5 === 2) add({ date, kind: 'urge', virtue: 'patience', stage: Math.min(4, 2 + Math.round(prog * 2)), need: 'calm' });
    if (d % 6 === 3) add({ date, kind: 'urge', virtue: 'diligence', stage: 1 + Math.round(prog * 1.5), need: 'clarity' });
    if (d % 9 === 4) {
      const p = 6 + (d % 4), a = Math.max(1, p - 3 - (d % 3));
      add({ date, kind: 'slip', virtue: d % 2 ? 'temperance' : 'patience', need: 'comfort', repairs: d % 2 ? { spouse: t } : { kids: t }, disclosedAt: t, predicted: p, actual: a, windowEndsAt: t + 900000 });
    }
  }
  add({ date: today, kind: 'act', actId: 'quiet', label: 'Took 10 quiet minutes', virtues: ['temperance', 'patience', 'diligence'], status: 'planned', expectLift: 3 });
  const weeklies = [];
  for (let w = 6; w >= 1; w--) {
    weeklies.push({ id: 'w' + w, weekOf: VT.dates.weekStart(VT.dates.addDays(today, -7 * w)), frictions: { temperance: 3 + Math.round(w * 0.9), patience: 2 + Math.round(w * 0.6), diligence: 4 + Math.round(w * 0.5) }, energy: w < 3 ? 'initiation' : 'restriction', compassion: 4, note: '', createdAt: Date.now() - w * 7 * 86400000 });
  }
  const settings = { ...VT.store.settings(), plans: [{ id: 'p1', virtue: 'temperance', when: 'I get home after a hard day', then: 'change clothes and walk for 10 minutes', actId: 'walk' }] };
  return JSON.stringify({ logs, weeklies, settings });
};
