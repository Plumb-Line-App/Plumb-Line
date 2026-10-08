// Turns stored data into a developmental read-out and feedback copy. Pure functions over data.
(function () {
  const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
  const round1 = VT.round1;
  const plural = VT.plural;

  function logsInRange(logs, fromKey, toKey) {
    return logs.filter((l) => l.date >= fromKey && l.date <= toKey);
  }

  const isFight = (l) => l.kind === 'urge' || l.kind === 'slip';
  const isDoneAct = VT.isDoneAct;

  const PHASES = [
    {
      max: 25,
      name: 'The Kantian Phase',
      message:
        'Right now, most of the work is duty: seeing the pull and refusing it. That takes real strength, and it counts. ' +
        'Willpower is a bridge, not a home — the goal is to make each fight a little less expensive, not to fight harder.',
    },
    {
      max: 50,
      name: 'Softening the Fight',
      message:
        'You’re still choosing deliberately, but the choices are getting smarter — a pause, a walk, a better option. ' +
        'This is where habits are actually built. Every constructive delay is a rep that makes the next one lighter.',
    },
    {
      max: 75,
      name: 'The Early Aristotelian Shift',
      message:
        'Space is starting to open on its own between the feeling and the pull. Right action is becoming less of a decision ' +
        'and more of a reflex. Notice what you reach for in that space — that’s the virtue taking root.',
    },
    {
      max: 101,
      name: 'Toward Aristotelian Harmony',
      message:
        'The old pull is mostly quiet. Hard days still come, but they no longer route automatically to the old habit. ' +
        'Guard the practices that got you here; second nature is kept by keeping it.',
    },
  ];
  const BEGINNING = 'Beginning the Journey';
  const phaseFor = (score) => (score == null ? null : PHASES.find((p) => score < p.max));

  // Weighted average over whichever parts have data.
  function blend(parts) {
    const have = parts.filter((p) => p.value != null);
    if (!have.length) return null;
    const w = have.reduce((a, p) => a + p.weight, 0);
    return have.reduce((a, p) => a + p.value * p.weight, 0) / w;
  }

  // Latest friction for one virtue, or (virtueId null) the average across the active virtues scored that week,
  // so a resting virtue's old scores stay out of the overall read-out.
  function latestFriction(weeklies, virtueId, activeIds = VT.VIRTUE_IDS) {
    const ids = virtueId ? [virtueId] : activeIds;
    for (let i = weeklies.length - 1; i >= 0; i--) {
      const f = avg(ids.map((id) => weeklies[i].frictions[id]).filter((x) => x != null));
      if (f != null) return round1(f);
    }
    return null;
  }
  const activeScope = (logs, activeIds) => logs.filter((l) => activeIds.some((id) => VT.inVirtue(l, id)));

  // 0 = fully Kantian, 100 = fully Aristotelian.
  // Stages over the last 30 days (50%), good acts crowding out fights (30%), latest weekly friction (20%).
  // The good-act share only counts once acts have been logged at all, and is damped (+2) so one act can't swing it.
  function measure(logs, weeklies, virtueId, today, activeIds) {
    const mine = logs.filter((l) => VT.inVirtue(l, virtueId));
    const last30 = logsInRange(mine, VT.dates.addDays(today, -29), today);
    const urges30 = last30.filter((l) => l.kind === 'urge');
    const slips30 = last30.filter((l) => l.kind === 'slip');
    const acts30 = last30.filter(isDoneAct).length;
    const fights30 = urges30.length + slips30.length;
    const counts = [1, 2, 3, 4].map((s) => urges30.filter((l) => l.stage === s).length);
    counts.push(slips30.length);
    const avgStage = avg(urges30.map((l) => l.stage));
    const friction = latestFriction(weeklies, virtueId, activeIds);
    const everActs = mine.some(isDoneAct);

    const score = blend([
      { value: avgStage != null ? ((avgStage - 1) / 3) * 100 : null, weight: 0.5 },
      // A quiet month (no acts and no fights) is no evidence either way, so it doesn't count as 0.
      { value: everActs && acts30 + fights30 > 0 ? (acts30 / (acts30 + fights30 + 2)) * 100 : null, weight: 0.3 },
      { value: friction != null ? ((10 - friction) / 9) * 100 : null, weight: 0.2 },
    ]);
    return { mine, counts, count30: last30.length, acts30, fights30, urges30: urges30.length, avgStage, latestFriction: friction, everActs, score };
  }

  function trendSentence(logs, today) {
    const urges = logs.filter((l) => l.kind === 'urge');
    const recent = logsInRange(urges, VT.dates.addDays(today, -13), today).map((l) => l.stage);
    const prior = logsInRange(urges, VT.dates.addDays(today, -27), VT.dates.addDays(today, -14)).map((l) => l.stage);
    if (recent.length < 3 || prior.length < 3) return '';
    const delta = avg(recent) - avg(prior);
    if (delta >= 0.3)
      return `Over the last two weeks your average stage rose from ${round1(avg(prior))} to ${round1(avg(recent))}. The ground is shifting.`;
    if (delta <= -0.3)
      return `The last two weeks have leaned heavier (${round1(avg(prior))} → ${round1(avg(recent))}). That’s information, not a verdict — what changed in your days?`;
    return 'Your last two weeks have been steady. Consistency is how second nature forms.';
  }

  function actSentence(m) {
    if (m.acts30 && m.fights30)
      return `You chose ${plural(m.acts30, 'good thing')} in the last 30 days — ${round1(m.acts30 / m.fights30)} for every urge or slip.`;
    if (m.acts30) return `You chose ${plural(m.acts30, 'good thing')} in the last 30 days, with no urges logged against them.`;
    if (m.fights30 && !m.everActs)
      return 'Next step: log the good things too — the walk, the real meal, the time with the kids. You become what you practice, and right now this only sees the fights.';
    return '';
  }

  // Average lift per act (all time), best first. Current names win over the name stored at log time.
  function liftByAct(doneActs, settings) {
    const names = new Map(settings.acts.map((a) => [a.id, a.label]));
    const byAct = new Map();
    for (const l of doneActs) {
      if (l.lift == null) continue;
      const key = l.actId || l.label;
      const cur = byAct.get(key) || { id: key, label: l.label, sum: 0, n: 0 };
      cur.sum += l.lift;
      cur.n += 1;
      byAct.set(key, cur);
    }
    return [...byAct.values()]
      .map((x) => ({ id: x.id, label: names.get(x.id) || x.label, avg: x.sum / x.n, n: x.n }))
      .sort((a, b) => b.avg - a.avg || b.n - a.n);
  }
  const toLiftMap = (rows) => Object.fromEntries(rows.map((x) => [x.id, x.avg]));

  VT.insights = {
    // Logs that belong to at least one active virtue ("All virtues" means the active ones).
    activeScope,

    // act id -> average lift, without the rest of the Journey analytics.
    liftMap: (logs, settings) => toLiftMap(liftByAct(logs.filter(isDoneAct), settings)),

    phaseName: (score) => (phaseFor(score) || { name: BEGINNING }).name,

    // Phase read-out for one virtue, or all active virtues when virtueId is null.
    summary(logs, weeklies, virtueId = null, activeIds = VT.VIRTUE_IDS, today = VT.dates.today()) {
      // Resting virtues keep their history but stay out of the overall read-out.
      const scoped = virtueId ? logs : activeScope(logs, activeIds);
      const m = measure(scoped, weeklies, virtueId, today, activeIds);
      let score = m.score;
      let perVirtue = [];
      if (!virtueId) {
        // Overall = the average of each active virtue's own position, so a busy virtue can't drown out a quiet one.
        perVirtue = activeIds.map((id) => {
          const s = measure(logs, weeklies, id, today).score;
          return { id, score: s, phase: VT.insights.phaseName(s) };
        });
        score = avg(perVirtue.map((p) => p.score).filter((s) => s != null));
      }

      const phase = phaseFor(score);
      let message;
      if (!phase) {
        message =
          'Log the next good thing you choose, or the next time a pull shows up — whatever stage it lands in. ' +
          'The point isn’t a perfect record; it’s seeing the pattern clearly enough to change it.';
      } else {
        message = phase.message;
        const acts = actSentence(m);
        if (acts) message += ' ' + acts;
        const trend = trendSentence(m.mine, today);
        if (trend) message += ' ' + trend;
        if (m.urges30 && m.urges30 < 4) message += ' A few more logs will sharpen this picture.';
      }

      return { ...m, mine: undefined, score, phase: phase ? phase.name : BEGINNING, message, perVirtue };
    },

    // Good-act analytics for the Journey tab.
    acts(logs, settings, virtueId = null, today = VT.dates.today()) {
      const mine = logs.filter((l) => VT.inVirtue(l, virtueId));
      const acts = mine.filter(isDoneAct);
      const fights = mine.filter(isFight);

      // Last 8 weeks, oldest first.
      const thisWeek = VT.dates.weekStart(today);
      const weeks = [];
      for (let i = 7; i >= 0; i--) {
        const start = VT.dates.addDays(thisWeek, -7 * i);
        const end = VT.dates.addDays(start, 6);
        weeks.push({
          weekOf: start,
          acts: acts.filter((l) => l.date >= start && l.date <= end).length,
          fights: fights.filter((l) => l.date >= start && l.date <= end).length,
        });
      }

      const lifts = liftByAct(acts, settings);
      const liftMap = toLiftMap(lifts);

      const pairs = acts.filter((l) => l.expectLift != null && l.lift != null);
      const avgExpect = avg(pairs.map((l) => l.expectLift));
      const avgLift = avg(pairs.map((l) => l.lift));

      let helps = '';
      if (lifts.length) {
        const top = lifts[0];
        helps = `“${top.label}” has helped most so far (${round1(top.avg)}/5 across ${plural(top.n, 'time')}). Reach for that one first when it’s hard.`;
      } else {
        helps = 'Rate how much a good act helped and you’ll see which ones actually lift you — so you can reach for those first.';
      }
      if (pairs.length) {
        helps += ` Before doing them, you expected ${round1(avgExpect)}/5 on average; they turned out ${round1(avgLift)}/5.`;
        if (avgLift - avgExpect > 0.05) helps += ' A low mood predicts that nothing will help. Your own numbers say otherwise.';
      }

      // What the urges and slips were really about.
      const needCounts = VT.NEEDS.map((n) => ({ ...n, count: fights.filter((l) => l.need === n.id).length })).filter((n) => n.count);
      needCounts.sort((a, b) => b.count - a.count);
      const needsMsg = needCounts.length
        ? `Most often, the pull was really about ${needCounts[0].name.toLowerCase()} (${needCounts[0].hint}). That’s the need to plan for.`
        : '';

      return { weeks, liftByAct: lifts, liftMap, pairs, avgExpect, avgLift, helps, needs: needCounts, needsMsg };
    },

    // Personalized feedback for a just-submitted weekly check-in.
    weeklyFeedback(entry, weeklies, logs, activeIds = VT.VIRTUE_IDS) {
      const idx = weeklies.findIndex((w) => w.id === entry.id);
      const before = idx > 0 ? weeklies.slice(0, idx) : [];
      const prev = before.length ? before[before.length - 1] : null;
      // A virtue may have been resting last week; compare against its own most recent score.
      const prevFriction = (id) => {
        for (let i = before.length - 1; i >= 0; i--) if (before[i].frictions[id] != null) return before[i].frictions[id];
        return null;
      };
      const out = [];

      // Friction, per virtue
      const bits = [];
      let rose = false;
      for (const id of activeIds) {
        const f = entry.frictions[id];
        if (f == null) continue;
        const name = VT.virtueById(id).name;
        const p = prevFriction(id);
        if (p == null) bits.push(`${name} starts at ${f}/10`);
        else if (f < p) bits.push(`${name} eased ${p} → ${f}`);
        else if (f > p) {
          bits.push(`${name} rose ${p} → ${f}`);
          rose = true;
        } else bits.push(`${name} held at ${f}`);
      }
      if (bits.length) {
        let t = `Friction: ${bits.join('; ')}.`;
        if (rose) t += ' Harder weeks happen — stress, sleep, circumstances. They don’t erase the ground you’ve gained.';
        else if (prev) t += ' Lower friction means the fight is getting lighter, not that you’re gripping tighter.';
        out.push(t);
      }

      // Energy focus
      if (entry.energy === 'initiation') {
        out.push('Your energy went toward doing right rather than avoiding wrong. That’s the Aristotelian move: virtue grows from what you practice, not just what you refuse.');
      } else {
        out.push('Your energy went mostly to holding back. That’s honest Kantian work. Next week, pair one pull with something to reach toward — a walk, a call, ten minutes on the floor with the kids — so restraint has somewhere to go.');
      }

      // Self-compassion
      const c = entry.compassion;
      if (c === 0) out.push('No slips worth noting — notice what made this week different and protect it.');
      else if (c >= 4) out.push('You met your slips with understanding. Curiosity, not shame, is what lets you learn from them.');
      else if (c === 3) out.push('Some judgment, some understanding. Try asking “what did I actually need?” before deciding what a slip means.');
      else out.push('Slips landed hard this week. Shame tends to feed the very loop you’re trying to leave. Treat the next one as data about what you needed, not evidence about who you are.');

      // That week's logs
      const weekAll = logsInRange(logs, entry.weekOf, VT.dates.addDays(entry.weekOf, 6));
      const weekUrges = weekAll.filter((l) => l.kind === 'urge');
      const weekSlips = weekAll.filter((l) => l.kind === 'slip' && VT.virtueById(l.virtue).repairs.length);
      const weekActs = weekAll.filter(isDoneAct);
      const weekFights = weekAll.filter(isFight).length;

      if (weekSlips.length) {
        const made = weekSlips.filter((l) => l.disclosed).length;
        if (made === weekSlips.length)
          out.push(`You repaired or shared every slip this week (${made} of ${made}). That is the cycle breaking in real time — secrecy had nothing to feed on.`);
        else if (made > 0)
          out.push(`You repaired or shared ${made} of ${weekSlips.length} slips. Each one said out loud is a loop that didn’t close. The others can still be made right — there’s no deadline on honesty.`);
        else
          out.push(`${weekSlips.length === 1 ? 'The slip' : 'The slips'} this week stayed private. That’s the old reflex, not a character flaw. One honest sentence — even days later — still counts as a full win.`);
      }

      if (weekActs.length) {
        let t = `You chose ${plural(weekActs.length, 'good thing')} this week against ${plural(weekFights, 'urge or slip', 'urges or slips')}.`;
        if (weekActs.length > weekFights) t += ' The good is starting to crowd out the fight.';
        const rated = weekActs.filter((l) => l.lift != null).sort((a, b) => b.lift - a.lift);
        if (rated.length) t += ` “${rated[0].label}” helped most (${rated[0].lift}/5).`;
        out.push(t);
      } else if (weekFights) {
        out.push('No good acts logged this week. Next week, pick one from your list and do it before the hard part of the day — not as a reward, as a practice.');
      }

      if (weekUrges.length) {
        const a = avg(weekUrges.map((l) => l.stage));
        const stage = VT.stageById(Math.round(a));
        out.push(`Across ${plural(weekUrges.length, 'logged moment')} that week, you averaged stage ${round1(a)} — closest to “${stage.name}.”`);
      }

      const W = VT.SCRIPTURE.weekly;
      const verse = c > 0 && c <= 2 ? W.shame : rose ? W.harder : entry.energy === 'initiation' ? W.initiation : W.default;
      return { paragraphs: out, verse };
    },

    // Honesty / repair read-out across virtues that have a repair step.
    honesty(logs, now = Date.now(), today = VT.dates.today()) {
      const slips = logs.filter((l) => l.kind === 'slip' && VT.virtueById(l.virtue).repairs.length);
      const slips30 = logsInRange(slips, VT.dates.addDays(today, -29), today);
      const shared30 = slips30.filter((l) => l.disclosed).length;
      const pendingOf = (l) => !l.disclosed && l.windowEndsAt && now < l.windowEndsAt;

      // Streak: most recent slips made right in a row. A slip whose window is still open hasn't broken anything yet.
      let streak = 0;
      for (const l of [...slips].sort((a, b) => b.createdAt - a.createdAt)) {
        if (l.disclosed) streak++;
        else if (pendingOf(l)) continue;
        else break;
      }

      const pairs = slips
        .filter((l) => l.disclosed && l.predicted != null && l.actual != null)
        .sort((a, b) => (a.disclosedAt || a.createdAt) - (b.disclosedAt || b.createdAt));
      const avgPred = avg(pairs.map((l) => l.predicted));
      const avgActual = avg(pairs.map((l) => l.actual));
      const gentler = pairs.filter((l) => l.actual < l.predicted).length;
      const harder = pairs.filter((l) => l.actual > l.predicted).length;
      const pending = slips.filter(pendingOf).length;
      const unshared = slips.filter((l) => !l.disclosed).length - pending;

      let message;
      if (!slips.length) {
        message = 'No slips logged yet. If one comes, the plan is simple: log it, make it right with whoever it touched, and let it stay small. Hidden things grow; spoken things shrink.';
      } else if (unshared === 0 && pending) {
        message = 'A slip is in its window right now. You don’t have to carry it — one honest sentence and it’s a double victory.';
      } else if (unshared === 0) {
        message = 'Every slip you’ve logged has been made right. That’s the real victory — the moment itself was one thing, but you refused to let it become a secret. Isolation is how these cycles survive, and you keep cutting off their air.';
      } else {
        message = `${plural(unshared, 'slip is', 'slips are')} still being carried alone. No judgment — hiding was a way of protecting yourself once. You can set ${unshared === 1 ? 'it' : 'them'} down whenever you’re ready; making it right late is still a full win.`;
      }

      let fear = '';
      if (pairs.length) {
        const gap = avgPred - avgActual;
        fear = `Across ${plural(pairs.length, 'conversation')}, you braced for an average of ${round1(avgPred)}/10. Reality averaged ${round1(avgActual)}/10. `;
        if (gap > 0.05)
          fear += `Your fear overestimated the cost of honesty by ${round1(gap)} points, and reality was gentler than predicted ${gentler} of ${pairs.length} times. The secret was always heavier than the truth.`;
        else if (gap < -0.05)
          fear += `Some of these were harder than expected (${harder} of ${pairs.length}). That’s real, and worth talking through together. Hard honest conversations still build something secrecy never can.`;
        else fear += 'Your predictions have been close to reality — and you still chose honesty each time.';
        if (pairs.length < 3) fear += ' A few more data points will make the pattern undeniable.';
      }

      return { slips30: slips30.length, shared30, streak, pairs, avgPred, avgActual, gentler, unshared, pending, message, fear };
    },

    // Copy for the moment banner. state: running | closed | celebrate | grace
    moment(state, entry) {
      const v = VT.virtueById(entry.virtue);
      const kidsFirst = VT.kidsFirst(v);
      const S = VT.SCRIPTURE;

      if (state === 'running') {
        return kidsFirst
          ? {
              eyebrow: 'Repair window',
              title: 'The pull to move on and pretend it didn’t happen is strong right now.',
              body: `Repair doesn’t need a speech. Get down to eye level with ${VT.kids()}, name what you did, and say you’re sorry. A quick repair teaches them the relationship is safe even when it gets loud.`,
              extra: entry.predicted != null ? `You’re bracing for ${entry.predicted}/10. Let’s see how close that is.` : '',
              verse: S.windowOpen,
            }
          : {
              eyebrow: 'Honesty window',
              title: 'The pull to hide is strongest right now.',
              body: `You don’t have to explain everything or have it figured out. One honest sentence to ${VT.spouse('your')} is enough to break the cycle. The panic you might be feeling is the old reflex — it passes faster once it’s said out loud.`,
              extra: entry.predicted != null ? `You’re bracing for ${entry.predicted}/10. Let’s see how close that is.` : '',
              verse: S.windowOpen,
            };
      }
      if (state === 'closed') {
        return kidsFirst
          ? {
              eyebrow: 'Repair window',
              title: 'The window closed. Repair still works.',
              body: 'Kids are generous with repair. Tonight at bedtime or tomorrow morning still counts: “I yelled earlier. That wasn’t okay, and it wasn’t your fault. I’m sorry.”',
              extra: '',
              verse: S.windowClosed,
            }
          : {
              eyebrow: 'Honesty window',
              title: 'The window closed. The door didn’t.',
              body: `Telling the truth later still counts — an hour from now, tonight, tomorrow. Nothing about this moment is final. Secrecy is what keeps this loop alive, and one sentence to ${VT.spouse('your')} ends it.`,
              extra: '',
              verse: S.windowClosed,
            };
      }
      if (state === 'grace') {
        return {
          eyebrow: 'Start again',
          title: 'No condemnation. Just the next step.',
          body: 'This is information, not identity. What’s the smallest next step you could take in the next ten minutes? Write it down, then do only that.',
          extra: '',
          verse: S.grace,
        };
      }

      // celebrate
      const r = entry.repairs || {};
      const inWindow = entry.windowEndsAt == null || (entry.disclosedAt && entry.disclosedAt <= entry.windowEndsAt);
      let extra = '';
      if (entry.predicted != null && entry.actual != null) {
        const d = entry.predicted - entry.actual;
        extra =
          `You braced for ${entry.predicted}/10. It was ${entry.actual}/10.` +
          (d > 0 ? ' Your fear was louder than reality.' : d < 0 ? ' Harder than expected — and you faced it instead of hiding.' : ' You read it right, and you still chose the truth.');
      }
      if (r.kids != null) {
        return {
          eyebrow: 'Double victory',
          title: inWindow ? 'You made it right. That’s the bigger win.' : 'Late still counts. You made it right.',
          body: 'The yell was one moment. The repair is what they’ll remember — that even when it gets loud, they’re safe with you and love comes back around.',
          extra,
          verse: S.repairedKids,
        };
      }
      const food = entry.virtue === 'temperance';
      return {
        eyebrow: 'Double victory',
        title: inWindow ? 'You told the truth. That’s the bigger win.' : 'Late still counts. You told the truth.',
        body: food
          ? 'The slip was one moment. Telling the truth is the pattern you’re building — and it’s the one that changes everything. You didn’t let this become a secret, and that matters more than what happened with food.'
          : `You didn’t carry it alone. Telling ${VT.spouse('your')} the truth about a hard moment is how it stays a moment instead of becoming a hidden pattern.`,
        extra,
        verse: S.repairedSpouse,
      };
    },

    // Days until the next check-in is due (7 days after the most recent one). Negative = overdue.
    checkInDue(weeklies, today = VT.dates.today()) {
      if (!weeklies.length) return null;
      const latest = weeklies.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      const last = VT.dates.toKey(new Date(latest.createdAt));
      return 7 - VT.dates.daysBetween(last, today);
    },
  };
})();
