// Virtues: each pairs a habit being left with the character being built.
// The 4-stage path, slips, repair, needs and good acts all hang off a virtue.
(function () {
  // Identity colours (validated as a set; lines also differ by point shape and dash for colour-blind readers).
  VT.VIRTUES = [
    {
      id: 'temperance',
      name: 'Temperance',
      area: 'with food',
      color: '#21905f',
      pointStyle: 'circle',
      dash: [],
      urgeLabel: 'I met an urge',
      urgeHint: 'Place it on the 4-stage scale',
      slipLabel: 'I slipped',
      slipHint: 'The truth still gets a win',
      slipIntro:
        'A slip is one moment, not a verdict on you. There are two separate questions here: what happened with food, ' +
        'and what you do next with the truth.',
      slipWin: 'The second one is the bigger win.',
      examples: {
        1: 'Wanted to eat to escape a heavy mood; white-knuckled it and felt deprived after.',
        2: 'Felt down after work and paused 10 minutes instead of opening the pantry.',
        3: 'Hard day, but cooking a real meal sounded better than snacking.',
        4: 'Stressful evening, and food never crossed my mind as the answer.',
      },
      notes: {
        urge: 'e.g. Felt down after work, paused for 10 minutes instead of opening the pantry.',
        slip: 'What was going on? e.g. Rough afternoon, ate standing at the counter.',
      },
      needs: ['rest', 'comfort', 'connection', 'stimulation', 'reward'],
      repairs: ['spouse'],
      verses: ['1 Corinthians 10:13', '1 Corinthians 6:12', 'Galatians 5:22-23'],
    },
    {
      id: 'patience',
      name: 'Patience',
      area: 'with the kids',
      color: '#8659b8',
      pointStyle: 'triangle',
      dash: [6, 4],
      urgeLabel: 'I felt the heat rise',
      urgeHint: 'Place it on the 4-stage scale',
      slipLabel: 'I snapped',
      slipHint: 'Repair still gets a win',
      slipIntro:
        'Snapping is one moment, not who you are as a parent. There are two separate questions here: what happened, ' +
        'and what you do next to repair it.',
      slipWin: 'Repair is the bigger win — it teaches them the relationship is safe even when it gets loud.',
      examples: {
        1: 'Bit my tongue so hard I was shaking, but I didn’t yell.',
        2: 'Felt the yell rising, stepped out for a breath, and came back calm.',
        3: 'Shoes still not on, but I knelt down and helped without the edge.',
        4: 'Chaos at dinner, and I genuinely enjoyed them anyway.',
      },
      notes: {
        urge: 'e.g. Bedtime dragging on; took three breaths and lowered my voice.',
        slip: 'What was going on? e.g. Running late, yelled about shoes in the hallway.',
      },
      needs: ['rest', 'calm', 'heard', 'comfort'],
      repairs: ['kids', 'spouse'],
      verses: ['James 1:19-20', 'Proverbs 15:1', 'Ephesians 6:4', 'Ephesians 4:26-27'],
    },
    {
      id: 'diligence',
      name: 'Diligence',
      area: 'with work & tasks',
      color: '#c4652a',
      pointStyle: 'rectRounded',
      dash: [2, 3],
      urgeLabel: 'I felt the pull to put it off',
      urgeHint: 'Place it on the 4-stage scale',
      slipLabel: 'I put it off',
      slipHint: 'Start again — no penalty',
      slipIntro:
        'Putting it off is one moment, not a verdict. Shame makes the next start harder, so skip it: name what happened ' +
        'and pick the smallest next step.',
      slipWin: '',
      examples: {
        1: 'Forced myself to sit there and grind; it was miserable.',
        2: 'Wanted to scroll, so I set a 10-minute timer and started.',
        3: 'Opened the laptop and just began the hard task.',
        4: 'Did the work because it mattered to me — no inner argument.',
      },
      notes: {
        urge: 'e.g. Wanted to check my phone; wrote the next step down and started it.',
        slip: 'What was going on? e.g. Didn’t know where to start, so I scrolled for an hour.',
      },
      needs: ['clarity', 'courage', 'rest', 'calm', 'stimulation'],
      repairs: [],
      verses: ['Colossians 3:23-24', 'Proverbs 13:4', 'Ecclesiastes 9:10'],
    },
  ];

  VT.virtueById = (id) => VT.VIRTUES.find((v) => v.id === id) || VT.VIRTUES[0];
  VT.VIRTUE_IDS = VT.VIRTUES.map((v) => v.id);

  // Who a slip can be repaired with.
  VT.REPAIRS = {
    spouse: {
      id: 'spouse',
      done: () => `I’ve told ${VT.spouse('my')}`,
      doneHint: 'Telling the truth is a full victory on its own.',
      action: () => `I told ${VT.spouse('my')}`,
    },
    kids: {
      id: 'kids',
      done: () => `I’ve apologized to ${VT.kids()}`,
      doneHint: 'Repair is what they’ll remember.',
      action: () => `I made it right with ${VT.kids()}`,
    },
  };

  // Button label for making a slip right: generic when there is more than one person to repair with.
  VT.repairAction = (v) => (v.repairs.length > 1 ? 'I made it right' : VT.REPAIRS[v.repairs[0]].action());
  // Is repairing with the kids this virtue's first step (repair-window wording rather than honesty-window)?
  VT.kidsFirst = (v) => v.repairs[0] === 'kids';

  // Good acts. `virtues` says which paths an act counts toward; an act with none counts toward
  // whichever virtue was selected when it was logged.
  VT.DEFAULT_ACTS = [
    { id: 'workout', label: 'Worked out', needs: ['stimulation', 'reward', 'calm'], virtues: ['temperance', 'patience'] },
    { id: 'walk', label: 'Went for a walk', needs: ['rest', 'comfort', 'calm', 'stimulation'], virtues: ['temperance', 'patience'] },
    { id: 'meal', label: 'Cooked a real meal', needs: ['comfort', 'reward'], virtues: ['temperance'] },
    { id: 'friend', label: 'Called a friend', needs: ['connection', 'heard'], virtues: ['temperance'] },
    { id: 'kids', label: 'Played with the kids', needs: ['connection', 'stimulation'], virtues: ['patience'] },
    { id: 'voice', label: 'Knelt down & lowered my voice', needs: ['calm', 'heard'], virtues: ['patience'] },
    { id: 'load', label: 'Took something off her plate', needs: ['connection'], virtues: [] },
    { id: 'quiet', label: 'Took 10 quiet minutes', needs: ['rest', 'calm', 'comfort'], virtues: ['temperance', 'patience', 'diligence'] },
    { id: 'prayer', label: 'Prayed / read scripture', needs: ['comfort', 'rest', 'calm', 'courage'], virtues: ['temperance', 'patience', 'diligence'] },
    { id: 'bed', label: 'In bed on time', needs: ['rest'], virtues: ['temperance', 'patience', 'diligence'] },
    { id: 'first10', label: 'Did the first 10 minutes', needs: ['courage', 'stimulation', 'clarity'], virtues: ['diligence'] },
    { id: 'nextstep', label: 'Wrote down the next step', needs: ['clarity', 'calm'], virtues: ['diligence'] },
    { id: 'hardfirst', label: 'Did the hardest task first', needs: ['courage'], virtues: ['diligence'] },
  ];

  // Acts offered under a virtue: those tagged for it, plus untagged ones.
  VT.actsFor = (acts, virtueId) => acts.filter((a) => !a.virtues.length || a.virtues.includes(virtueId));

  VT.isDoneAct = (log) => log.kind === 'act' && log.status === 'done';

  // Does a log belong to a virtue? (null = all virtues)
  VT.inVirtue = (log, virtueId) => {
    if (!virtueId) return true;
    if (log.kind === 'act') return (log.virtues || []).includes(virtueId);
    return log.virtue === virtueId;
  };
})();
