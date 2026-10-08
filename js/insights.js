// Turns stored data into a developmental read-out and weekly feedback. Pure functions over data.
(function () {
  const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
  const round1 = (n) => Math.round(n * 10) / 10;

  function logsInRange(logs, fromKey, toKey) {
    return logs.filter((l) => l.date >= fromKey && l.date <= toKey);
  }

  const PHASES = [
    {
      max: 25,
      name: 'The Kantian Phase',
      message:
        'Right now, most of the work is duty: seeing the urge and refusing it. That takes real strength, and it counts. ' +
        'Willpower is a bridge, not a home — the goal over the coming weeks is to make each fight a little less expensive, ' +
        'not to fight harder.',
    },
    {
      max: 50,
      name: 'Softening the Fight',
      message:
        'You’re still choosing deliberately, but the choices are getting smarter — a pause, a walk, a different comfort. ' +
        'This is where habits are actually built. Every constructive delay is a rep that makes the next one lighter.',
    },
    {
      max: 75,
      name: 'The Early Aristotelian Shift',
      message:
        'Space is starting to open on its own between a heavy mood and the urge. Right action is becoming less of a decision ' +
        'and more of a reflex. Notice what you reach for in that space — that’s the virtue taking root.',
    },
    {
      max: 101,
      name: 'Toward Aristotelian Harmony',
      message:
        'Food is mostly sitting in its proper place: nourishment, not rescue. Hard days still come, but they no longer route ' +
        'automatically to the pantry. Guard the practices that got you here; second nature is kept by keeping it.',
    },
  ];

  // 0 = fully Kantian, 100 = fully Aristotelian. Blends recent stages (70%) with latest friction (30%).
  function phaseScore(avgStage, latestFriction) {
    const stagePart = avgStage != null ? ((avgStage - 1) / 3) * 100 : null;
    const frictionPart = latestFriction != null ? ((10 - latestFriction) / 9) * 100 : null;
    if (stagePart != null && frictionPart != null) return stagePart * 0.7 + frictionPart * 0.3;
    return stagePart ?? frictionPart;
  }

  function trendSentence(allLogs, today) {
    const logs = allLogs.filter((l) => l.kind === 'urge');
    const recent = logsInRange(logs, VT.dates.addDays(today, -13), today).map((l) => l.stage);
    const prior = logsInRange(logs, VT.dates.addDays(today, -27), VT.dates.addDays(today, -14)).map((l) => l.stage);
    if (recent.length < 3 || prior.length < 3) return '';
    const delta = avg(recent) - avg(prior);
    if (delta >= 0.3)
      return `Over the last two weeks your average stage rose from ${round1(avg(prior))} to ${round1(avg(recent))}. The ground is shifting.`;
    if (delta <= -0.3)
      return `The last two weeks have leaned heavier (${round1(avg(prior))} → ${round1(avg(recent))}). That’s information, not a verdict — what changed in your days?`;
    return 'Your last two weeks have been steady. Consistency is how second nature forms.';
  }

  VT.insights = {
    summary(logs, weeklies, today = VT.dates.today()) {
      const last30 = logsInRange(logs, VT.dates.addDays(today, -29), today);
      const urges30 = last30.filter((l) => l.kind === 'urge');
      const counts = [1, 2, 3, 4].map((s) => urges30.filter((l) => l.stage === s).length);
      counts.push(last30.filter((l) => l.kind === 'slip').length);
      const avgStage = avg(urges30.map((l) => l.stage));
      const latestFriction = weeklies.length ? weeklies[weeklies.length - 1].friction : null;
      const score = phaseScore(avgStage, latestFriction);

      if (score == null) {
        return {
          counts,
          count30: last30.length,
          avgStage: null,
          latestFriction: null,
          score: null,
          phase: 'Beginning the Journey',
          message:
            'Log the next time an urge shows up — whatever stage it lands in. The point isn’t a perfect record; ' +
            'it’s seeing the pattern clearly enough to change it.',
        };
      }

      const phase = PHASES.find((p) => score < p.max);
      let message = phase.message;
      const trend = trendSentence(logs, today);
      if (trend) message += ' ' + trend;
      if (urges30.length && urges30.length < 4) message += ' A few more logs will sharpen this picture.';

      return { counts, count30: last30.length, avgStage, latestFriction, score, phase: phase.name, message };
    },

    // Personalized feedback for a just-submitted weekly check-in. Returns an array of paragraphs.
    weeklyFeedback(entry, weeklies, logs) {
      const idx = weeklies.findIndex((w) => w.id === entry.id);
      const prev = idx > 0 ? weeklies[idx - 1] : null;
      const out = [];

      // Friction
      if (!prev) {
        out.push(
          `Friction ${entry.friction}/10 is your baseline. From here, the line on your chart is the story — ` +
            'the aim is for it to drift down because the fight is getting lighter, not because you’re gripping tighter.'
        );
      } else {
        const d = entry.friction - prev.friction;
        if (d <= -2)
          out.push(`Friction dropped from ${prev.friction} to ${entry.friction}. That’s a real loosening — duty is starting to give way to ease.`);
        else if (d < 0)
          out.push(`Friction eased from ${prev.friction} to ${entry.friction}. Small drops compound; this is how effort becomes habit.`);
        else if (d === 0)
          out.push(`Friction held at ${entry.friction}. Holding steady through a full week is its own kind of progress.`);
        else
          out.push(
            `Friction rose from ${prev.friction} to ${entry.friction}. Harder weeks happen — stress, sleep, circumstances. ` +
              'It doesn’t erase the ground you’ve gained.'
          );
      }

      // Energy focus
      if (entry.energy === 'initiation') {
        out.push(
          'Your energy went toward doing right rather than avoiding wrong. That’s the Aristotelian move: ' +
            'virtue grows from what you practice, not just what you refuse.'
        );
      } else {
        out.push(
          'Your energy went mostly to holding back. That’s honest Kantian work. Next week, try pairing one urge with something ' +
            'to reach toward — a walk, a call, a real meal — so restraint has somewhere to go.'
        );
      }

      // Self-compassion
      const c = entry.compassion;
      if (c === 0) out.push('No slips worth noting — notice what made this week different and protect it.');
      else if (c >= 4) out.push('You met your slips with understanding. Curiosity, not shame, is what lets you learn from them.');
      else if (c === 3) out.push('Some judgment, some understanding. Try asking “what was I actually hungry for?” before deciding what a slip means.');
      else
        out.push(
          'Slips landed hard this week. Shame tends to feed the very loop you’re trying to leave. ' +
            'Treat the next one as data about what you needed, not evidence about who you are.'
        );

      // Tie-in with that week's daily logs
      const weekAll = logsInRange(logs, entry.weekOf, VT.dates.addDays(entry.weekOf, 6));
      const weekLogs = weekAll.filter((l) => l.kind === 'urge');
      const weekSlips = weekAll.filter((l) => l.kind === 'slip');
      if (weekSlips.length) {
        const told = weekSlips.filter((l) => l.disclosed).length;
        const who = VT.spouse('your');
        if (told === weekSlips.length)
          out.push(`You told ${who} about every slip this week (${told} of ${told}). That is the cycle breaking in real time \u2014 secrecy had nothing to feed on.`);
        else if (told > 0)
          out.push(`You shared ${told} of ${weekSlips.length} slips with ${who}. Each one you said out loud is a loop that didn\u2019t close. The others can still be shared \u2014 there\u2019s no deadline on honesty.`);
        else
          out.push(`${weekSlips.length === 1 ? 'The slip' : 'The slips'} this week stayed private. That\u2019s the old reflex, not a character flaw. One honest sentence to ${who} \u2014 even days later \u2014 still counts as a full win.`);
      }
      if (weekLogs.length) {
        const a = avg(weekLogs.map((l) => l.stage));
        const stage = VT.stageById(Math.round(a));
        out.push(`Across ${weekLogs.length} logged moment${weekLogs.length === 1 ? '' : 's'} that week, you averaged stage ${round1(a)} — closest to “${stage.name}.”`);
      }

      return out;
    },

    // Honesty read-out: double victories, streak, and the fear-vs-reality gap.
    honesty(logs, now = Date.now(), today = VT.dates.today()) {
      const slips = logs.filter((l) => l.kind === 'slip');
      const slips30 = logsInRange(slips, VT.dates.addDays(today, -29), today);
      const shared30 = slips30.filter((l) => l.disclosed).length;

      // Streak: most recent slips shared in a row. A slip whose window is still open hasn't broken anything yet.
      let streak = 0;
      for (const l of [...slips].sort((a, b) => b.createdAt - a.createdAt)) {
        if (l.disclosed) streak++;
        else if (l.windowEndsAt && now < l.windowEndsAt) continue;
        else break;
      }

      const pairs = slips.filter((l) => l.disclosed && l.predicted != null && l.actual != null).sort((a, b) => (a.disclosedAt || a.createdAt) - (b.disclosedAt || b.createdAt));
      const avgPred = avg(pairs.map((l) => l.predicted));
      const avgActual = avg(pairs.map((l) => l.actual));
      const gentler = pairs.filter((l) => l.actual < l.predicted).length;
      const harder = pairs.filter((l) => l.actual > l.predicted).length;
      const pending = slips.filter((l) => !l.disclosed && l.windowEndsAt && now < l.windowEndsAt).length;
      const unshared = slips.filter((l) => !l.disclosed).length - pending;
      const who = VT.spouse('your');

      let message;
      if (!slips.length) {
        message = `No slips logged yet. If one comes, the plan is simple: log it, tell ${who}, and let it stay small. Hidden things grow; spoken things shrink.`;
      } else if (unshared === 0 && pending) {
        message = `A slip is in its honesty window right now. You don\u2019t have to carry it \u2014 one sentence to ${who} and it\u2019s a double victory.`;
      } else if (unshared === 0) {
        message = `Every slip you’ve logged has been shared. That’s the real victory here — the food moment was one thing, but you refused to let it become a secret. Isolation is how this cycle survives, and you keep cutting off its air.`;
      } else {
        message = `${unshared} slip${unshared === 1 ? ' is' : 's are'} still being carried alone. No judgment — hiding was a way of protecting yourself once. You can set ${unshared === 1 ? 'it' : 'them'} down whenever you’re ready; sharing late is still a full win.`;
      }

      let fear = '';
      if (pairs.length) {
        const gap = avgPred - avgActual;
        fear = `Across ${pairs.length} conversation${pairs.length === 1 ? '' : 's'}, you braced for an average of ${round1(avgPred)}/10. Reality averaged ${round1(avgActual)}/10. `;
        if (gap > 0.05)
          fear += `Your fear overestimated the cost of honesty by ${round1(gap)} points, and reality was gentler than predicted ${gentler} of ${pairs.length} times. The secret was always heavier than the truth.`;
        else if (gap < -0.05)
          fear += `Some of these were harder than expected (${harder} of ${pairs.length}). That’s real, and it’s worth talking through together. Hard honest conversations still build something secrecy never can.`;
        else fear += 'Your predictions have been close to reality — and you still chose honesty each time.';
        if (pairs.length < 3) fear += ' A few more data points will make the pattern undeniable.';
      }

      return { slips30: slips30.length, shared30, streak, pairs, avgPred, avgActual, gentler, unshared, message, fear };
    },

    // Copy for the moment banner.
    moment(state, entry) {
      const who = VT.spouse('your');
      if (state === 'running') {
        return {
          eyebrow: 'Honesty window',
          title: 'The pull to hide is strongest right now.',
          body: `You don’t have to explain everything or have it figured out. One honest sentence to ${who} is enough to break the cycle. The panic you might be feeling is the old reflex — it passes faster once it’s said out loud.`,
          extra: entry.predicted != null ? `You’re bracing for ${entry.predicted}/10. Let’s see how close that is.` : '',
        };
      }
      if (state === 'closed') {
        return {
          eyebrow: 'Honesty window',
          title: 'The window closed. The door didn’t.',
          body: `Telling the truth later still counts — an hour from now, tonight, tomorrow. Nothing about this moment is final. Secrecy is what keeps this loop alive, and one sentence to ${who} ends it.`,
          extra: '',
        };
      }
      // celebrate
      const inWindow = entry.windowEndsAt == null || (entry.disclosedAt && entry.disclosedAt <= entry.windowEndsAt);
      let extra = '';
      if (entry.predicted != null && entry.actual != null) {
        const d = entry.predicted - entry.actual;
        extra = `You braced for ${entry.predicted}/10. It was ${entry.actual}/10.` +
          (d > 0 ? ' Your fear was louder than reality.' : d < 0 ? ' Harder than expected — and you faced it together instead of alone.' : ' You read it right, and you still chose the truth.');
      }
      return {
        eyebrow: 'Double victory',
        title: inWindow ? 'You told the truth. That’s the bigger win.' : 'Late still counts. You told the truth.',
        body:
          'The slip was one moment. Telling the truth is the pattern you’re building — and it’s the one that changes everything. ' +
          'You didn’t let this become a secret, and that matters more than what happened with food.',
        extra,
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
