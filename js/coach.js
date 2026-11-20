// Coaching content: becoming a husband she is safe with. Five pillars, learned in order (remove the threat
// first, then add the warmth), each with daily practices; playbooks for hard moments; and one question a
// week to ask her, so progress is measured by her read, not by self-grading.
(function () {
  VT.PILLARS = [
    {
      id: 1,
      name: 'Steady',
      herView: 'His reactions won’t hurt me.',
      summary: 'No harshness aimed at her. When you’re flooded, take a break and come back. Repair fast.',
      why: 'Safety starts with predictability. If she can’t guess how you’ll react, every hard conversation costs her something before it starts. Nothing warmer can be built until this ground holds.',
      verse: 'Colossians 3:19',
    },
    {
      id: 2,
      name: 'Turn toward',
      herView: 'When I reach for him, he’s there.',
      summary: 'Notice her small bids for attention — a comment, a sigh, “look at this” — and respond.',
      why: 'Marriage research (Gottman) finds that how a husband answers small everyday bids is one of the strongest predictors of a marriage that lasts. Connection is built in seconds, many times a day.',
      verse: 'James 1:19-20',
    },
    {
      id: 3,
      name: 'Understand before fixing',
      herView: 'I can tell him how I feel without being corrected or solved.',
      summary: 'Reflect what she said and ask what it’s like for her before offering any fix.',
      why: 'A fix offered too early tells her the feeling was a problem to get rid of. Being understood first is what makes it safe to bring the next thing.',
      verse: 'Proverbs 18:13',
    },
    {
      id: 4,
      name: 'Nothing hidden',
      herView: 'There’s nothing behind the curtain.',
      summary: 'Transparency: tell her the hard things yourself, early and plainly.',
      why: 'Every hidden thing is a crack she can sense even when she can’t see it. Telling the truth yourself, soon and small, is how trust is rebuilt.',
      verse: 'Ephesians 4:25',
    },
    {
      id: 5,
      name: 'Honor and pursue',
      herView: 'I’m treasured, not just managed.',
      summary: 'Praise her, carry load unasked, take her influence seriously, and keep pursuing her.',
      why: 'Built on steadiness, pursuit lands as love instead of performance. Husbands who accept their wives’ influence also tend to have steadier marriages (Gottman).',
      verse: 'Ephesians 5:28-29',
    },
  ];
  VT.pillarById = (id) => VT.PILLARS.find((p) => p.id === Number(id)) || VT.PILLARS[0];

  // One practice a day from the current pillar. Small, concrete, doable on a hard day.
  VT.PRACTICES = {
    1: [
      { id: 's-level', text: 'If she brings up something hard today, your only job is a level voice. Not winning, not explaining. Level.' },
      { id: 's-soften', text: 'Catch one edge in your voice today and soften it mid-sentence: “Let me say that better.”' },
      { id: 's-timeout', text: 'Agree on a break phrase with her: “I’m getting flooded. I need 20 minutes, and I’ll come back.” If you use it, come back on time.' },
      { id: 's-car', text: 'Before you walk in tonight, sit in the car for one minute. Breathe, and decide who you’ll be when she sees you.' },
      { id: 's-sarcasm', text: 'No sarcasm aimed at her today. Not even the joking kind.' },
      { id: 's-repair', text: 'If you snap today, repair within the hour: “That was harsh. You didn’t deserve it. I’m sorry.” No “but.”' },
      { id: 's-trigger', text: 'Notice what tired, hungry or rushed does to your tone. Name one trigger in tonight’s review.' },
      { id: 's-maybe', text: 'When she’s frustrated with you, say “You might be right — tell me more” before anything else.' },
    ],
    2: [
      { id: 't-bids', text: 'Watch for her bids today — a comment, a sigh, “look at this.” Turn toward at least three: look up, answer, engage.' },
      { id: 't-phone', text: 'Phone face-down and out of reach for the first 20 minutes after you get home.' },
      { id: 't-body', text: 'When she starts talking, stop what you’re doing and turn your whole body toward her.' },
      { id: 't-hardest', text: 'Ask one question about her day that isn’t logistics: “What was the hardest part?”' },
      { id: 't-text', text: 'Text her once today with no task in it. Just that you’re thinking about her.' },
      { id: 't-greet', text: 'Greet her first when you walk in — before the kids, before the mail. A real hello, a real hug.' },
      { id: 't-follow', text: 'Follow up on something she mentioned in passing: “You said earlier… how did that go?”' },
      { id: 't-ten', text: 'Ten minutes tonight after the kids are down, no screens: just the two of you, talking about anything but schedules.' },
    ],
    3: [
      { id: 'u-ask', text: 'When she shares a problem, ask: “Do you want help, or do you want me to listen?” Honor the answer.' },
      { id: 'u-reflect', text: 'Reflect before you respond: “So what I’m hearing is…” Let her correct you.' },
      { id: 'u-validate', text: 'Validate one feeling today: “That makes sense.” You can validate a feeling without agreeing with every word.' },
      { id: 'u-hold', text: 'Hold your solution for one whole conversation. Ask “What’s that like for you?” instead.' },
      { id: 'u-true', text: 'When she criticizes you, find the part that’s true — even 2% — and say it out loud first.' },
      { id: 'u-inner', text: 'Ask about her inner world: “What’s been on your mind lately that we haven’t talked about?”' },
      { id: 'u-learn', text: 'Learn one thing about her this week you didn’t know — a worry, a hope, a memory.' },
    ],
    4: [
      { id: 'n-decide', text: 'If there’s anything you’ve been keeping from her, decide today when you’ll tell her. Coach has the words.' },
      { id: 'n-struggle', text: 'Tell her one thing you’re struggling with before she has to ask.' },
      { id: 'n-same-day', text: 'If you slip today, tell her the same day. Small and soon beats big and late.' },
      { id: 'n-volunteer', text: 'Volunteer where your time or money went today, if it’s something she’d want to know.' },
      { id: 'n-feeling', text: 'Share one feeling, not just a fact: “I felt discouraged after work today.”' },
      { id: 'n-wondered', text: 'Ask: “Is there anything you’ve wondered about but haven’t asked me?” Answer plainly.' },
      { id: 'n-phone', text: 'Keep nothing on your phone you’d be uncomfortable with her seeing.' },
    ],
    5: [
      { id: 'h-admire', text: 'Tell her one specific thing you admire about her — something she did, not just “you’re great.”' },
      { id: 'h-praise', text: 'Praise her to someone else where she can hear it — or to the kids.' },
      { id: 'h-plate', text: 'Take one task off her plate today without being asked, and don’t announce it.' },
      { id: 'h-date', text: 'Plan a date — even at home after bedtime. You handle every detail.' },
      { id: 'h-influence', text: 'When she makes a request, take it seriously before deciding: “Let me think about that — you may be right.”' },
      { id: 'h-note', text: 'Write her a short note and leave it where she’ll find it.' },
      { id: 'h-night', text: 'Take the night routine or a feed so she can sleep, or have an hour to herself.' },
      { id: 'h-honors', text: 'Small honors, every time today: hold the door, carry the heavy thing, let her sit first.' },
    ],
  };

  // Ask her once a week, when things are calm. Listen, thank her, don't defend. Questions follow the pillar.
  VT.QUESTIONS = [
    { id: 'q-harder', pillar: 1, text: 'Is there anything that makes it harder to tell me things?' },
    { id: 'q-frustrated', pillar: 1, text: 'When I get frustrated, what does it feel like on your end?' },
    { id: 'q-hurts', pillar: 1, text: 'Is there anything I keep doing that hurts, that I might not see?' },
    { id: 'q-cared', pillar: 2, text: 'When did you feel most cared for by me this week?' },
    { id: 'q-missed', pillar: 2, text: 'Was there a time this week you reached for me and I missed it?' },
    { id: 'q-mind', pillar: 3, text: 'What’s something on your mind lately that I don’t know about?' },
    { id: 'q-helps', pillar: 3, text: 'When you tell me something hard, what helps most — me listening, or me helping fix it?' },
    { id: 'q-wondered', pillar: 4, text: 'Is there anything you’ve wondered about but haven’t asked me?' },
    { id: 'q-know', pillar: 4, text: 'Do you feel like you know what’s going on with me? What would help?' },
    { id: 'q-plate', pillar: 5, text: 'What’s one thing I could take off your plate this week?' },
    { id: 'q-respected', pillar: 5, text: 'What’s something I did recently that made you feel respected?' },
    { id: 'q-together', pillar: 5, text: 'What’s something you’d love for us to do together soon?' },
  ];
  VT.QUESTION_RULES = 'Ask once, when things are calm. Listen all the way through, thank her, and don’t defend or explain. Then write down what she said.';

  // Coach: what to do in the moment. Three steps, words to say, what to avoid.
  VT.PLAYBOOKS = [
    {
      id: 'upset',
      title: 'She’s upset with me',
      steps: [
        'Slow down. Lower your voice; sit down if you’re standing.',
        'Hear the whole thing before you answer. Then say back what you heard.',
        'Own your part first — even if it’s only 10%.',
      ],
      say: '“You’re right that I ___. I’m sorry. Tell me more about how that landed.”',
      avoid: 'Explaining what you meant before she feels heard. The word “but.” A complaint of your own.',
      verse: 'Proverbs 15:1',
    },
    {
      id: 'defensive',
      title: 'I’m getting defensive',
      steps: [
        'Notice the signs: hot face, rehearsing your rebuttal while she talks.',
        'Pause out loud: “Give me a second — I want to actually hear you.”',
        'Find the part that’s true and say it before anything else.',
      ],
      say: '“That’s fair. I did ___.”',
      avoid: '“That’s not what I meant” as your first response.',
      verse: 'James 1:19-20',
    },
    {
      id: 'flooded',
      title: 'I’m about to snap',
      steps: [
        'Name it before it comes out: you’re too heated to be good for this right now.',
        'Take a real break — at least 20 minutes. Walk, breathe; don’t rehearse the argument.',
        'Come back when you said you would, and pick it up gently.',
      ],
      say: '“I’m getting too heated to do this well. I need 20 minutes, and I’ll come back — this matters to me.”',
      avoid: 'Walking out without saying you’ll return. Coming back still armed.',
      verse: 'Ephesians 4:26-27',
    },
    {
      id: 'snapped',
      title: 'I snapped at her',
      steps: [
        'Go to her soon. Don’t just move on and hope it fades.',
        'Own it plainly, with no excuse attached.',
        'Ask how it landed, and listen. Don’t ask her to reassure you.',
      ],
      say: '“I spoke harshly to you earlier. That wasn’t fair to you, and it’s not who I want to be. I’m sorry.”',
      avoid: '“I was just tired.” “You know I didn’t mean it.” Any sentence with “but.”',
      verse: 'Ephesians 4:32',
      done: 'I made it right',
    },
    {
      id: 'overwhelmed',
      title: 'She’s overwhelmed',
      steps: [
        'Don’t fix first. Acknowledge it: “That’s a lot. I’m here.”',
        'Take something concrete off her without asking permission: kids, dishes, bedtime.',
        'Later, when it’s calmer: “What would help most tomorrow?”',
      ],
      say: '“That’s a lot. I’ve got the kids — go sit down.”',
      avoid: 'A list of what she could do differently. Asking “what do you need?” when you can already see it.',
      verse: 'Galatians 6:2',
    },
    {
      id: 'quiet',
      title: 'She’s gone quiet',
      steps: [
        'Name it gently, with no pressure.',
        'Stay near: sit with her, bring her something warm. Don’t take it personally.',
        'Check back later if she didn’t want to talk then.',
      ],
      say: '“You seem quiet. I’m here if you want to talk — no pressure.”',
      avoid: 'Demanding an answer. Getting quiet back.',
      verse: 'Proverbs 20:5',
    },
    {
      id: 'after-fight',
      title: 'After a fight',
      steps: [
        'Repair the same day, even if nothing’s solved yet.',
        'Each of you names your own part. You go first.',
        'Turn back toward her with something small: a touch, a joke, a cup of coffee.',
      ],
      say: '“I don’t like how that went. Can we try again? My part was ___.”',
      avoid: 'Waiting for her to come to you. Re-arguing the point.',
      verse: 'Ephesians 4:26-27',
    },
    {
      id: 'tell',
      title: 'I need to tell her something hard',
      steps: [
        'Pick a calm moment soon — today if you can.',
        'Say it plainly and own it. Don’t minimize it or wrap it in excuses.',
        'Let her react without managing it. Thank her for hearing you.',
      ],
      say: 'The words are ready below in “Make it right.”',
      avoid: 'Waiting for a perfect moment. Telling half of it.',
      verse: 'Proverbs 28:13',
      words: true,
    },
  ];

  // Today's practice: the same one all day, rotating day by day through the pillar.
  VT.coach = {
    practiceFor(pillar, dateKey = VT.dates.today(), offset = 0) {
      const list = VT.PRACTICES[pillar] || VT.PRACTICES[1];
      const n = VT.dates.daysBetween('2026-01-01', dateKey) + offset;
      return list[((n % list.length) + list.length) % list.length];
    },
    // This week's question: rotates through the current pillar's questions week by week.
    questionFor(pillar, dateKey = VT.dates.today()) {
      const list = VT.QUESTIONS.filter((q) => q.pillar === Number(pillar));
      const week = Math.floor(VT.dates.daysBetween('2026-01-05', VT.dates.weekStart(dateKey)) / 7);
      return list[((week % list.length) + list.length) % list.length];
    },
    daysIn(since, dateKey = VT.dates.today()) {
      return since ? VT.dates.daysBetween(since, dateKey) + 1 : 1;
    },
  };
})();
