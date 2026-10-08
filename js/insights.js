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

  function trendSentence(logs, today) {
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
      const counts = [1, 2, 3, 4].map((s) => last30.filter((l) => l.stage === s).length);
      const avgStage = avg(last30.map((l) => l.stage));
      const latestFriction = weeklies.length ? weeklies[weeklies.length - 1].friction : null;
      const score = phaseScore(avgStage, latestFriction);

      if (score == null) {
        return {
          counts,
          count30: 0,
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
      if (last30.length && last30.length < 4) message += ' A few more logs will sharpen this picture.';

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
      const weekLogs = logsInRange(logs, entry.weekOf, VT.dates.addDays(entry.weekOf, 6));
      if (weekLogs.length) {
        const a = avg(weekLogs.map((l) => l.stage));
        const stage = VT.stageById(Math.round(a));
        out.push(`Across ${weekLogs.length} logged moment${weekLogs.length === 1 ? '' : 's'} that week, you averaged stage ${round1(a)} — closest to “${stage.name}.”`);
      }

      return out;
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
