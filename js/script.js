// Repair script generator: vulnerability first, ownership without self-punishment, one clear ask.
// Two audiences: a spouse (honesty about a slip) and the kids (repair after snapping).
(function () {
  // What happened, per audience. `virtue` picks the line about what the old habit did.
  const WHAT = {
    spouse: [
      { id: 'more', virtue: 'temperance', label: 'I ate more than I meant to', text: 'ate more than I meant to' },
      { id: 'escape', virtue: 'temperance', label: 'I ate to escape a hard feeling', text: 'ate to get away from a hard feeling' },
      { id: 'secret', virtue: 'temperance', label: 'I ate in secret', text: 'ate in secret' },
      { id: 'hid', virtue: 'temperance', label: 'I hid food from you', text: 'hid food from you' },
      { id: 'nearly', virtue: 'temperance', label: 'I almost kept a slip from you', text: 'slipped with food, and my first instinct was to keep it from you' },
      { id: 'yelled', virtue: 'patience', label: 'I yelled at the kids', text: 'yelled at the kids' },
      { id: 'snapped', virtue: 'patience', label: 'I snapped at you', text: 'snapped at you' },
      { id: 'custom', virtue: null, label: 'Something else…' },
    ],
    kids: [
      { id: 'yelled', label: 'I yelled', text: 'I yelled at you' },
      { id: 'mean', label: 'I used a mean, loud voice', text: 'I used a mean, loud voice with you' },
      { id: 'scary', label: 'I got scary-angry', text: 'I got really angry, and that was scary' },
      { id: 'custom', label: 'Something else…' },
    ],
  };

  // How the old habit showed up, for the spouse message.
  const TURN = {
    temperance: 'I reached for food instead of reaching for you',
    patience: 'it came out sideways instead of me slowing down',
    null: 'I fell back on an old habit',
  };

  const FEELING = {
    down: 'really down',
    stressed: 'stressed',
    lonely: 'lonely',
    tired: 'worn out',
    anxious: 'anxious',
    hurried: 'hurried and overloaded',
    numb: 'kind of numb',
    unsure: 'off — I’m honestly not sure what it was',
  };

  const NEED = {
    nothing: 'You don’t need to do anything. I just didn’t want to hide it from you.',
    listen: 'Could you just listen for a minute when you have a chance? I don’t need it fixed.',
    hug: 'Honestly, I could use a hug.',
    plan: 'Would you help me think through tomorrow so I have a better plan?',
  };

  const SPOUSE = [
    (v) => `${v.hi}this is hard to say, but I don’t want to hide it from you. Earlier I ${v.what}. I was feeling ${v.feeling}, and ${v.turn}. ${v.need}`,
    (v) => `${v.hi}I’m telling you this because keeping it to myself is the part that actually hurts us. I ${v.what} today. I think I was ${v.feeling}. I’m working on it, and being honest with you is part of that. ${v.need}`,
    (v) => `${v.hi}can I tell you something hard? I ${v.what}. I was ${v.feeling}. I’d rather you hear it from me than have me carry it alone. ${v.need}`,
    (v) => `${v.hi}I’m practicing not hiding things from you, so here goes. I ${v.what}. I was ${v.feeling} and fell back on the old habit. I’m not beating myself up — I just want you in this with me. ${v.need}`,
  ];

  // Short, concrete, no excuses, the child is never blamed, and the relationship is reaffirmed.
  const KIDS = [
    (v) => `Hey ${v.kid}, earlier ${v.what}. That wasn’t okay, and it wasn’t your fault. I’m sorry. I love you. Can we have a do-over?`,
    (v) => `${v.kid}, ${v.what}. Staying calm is my job, not yours, and I didn’t do it. I’m sorry. Next time I’m going to take a big breath first.`,
    (v) => `Hey ${v.kid}, I was wrong — ${v.what}. Even when I’m frustrated, you’re always safe with me. I’m sorry. Will you forgive me?`,
  ];

  const clean = (s) => (s || '').trim().replace(/[.\s]+$/, '');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const wrap = (list, i) => list[((i % list.length) + list.length) % list.length];

  VT.script = {
    WHAT,
    FEELING,
    NEED,
    count: (to) => (to === 'kids' ? KIDS : SPOUSE).length,

    build({ to = 'spouse', name, what, whatCustom, feeling, need }, variant = 0) {
      const opts = WHAT[to] || WHAT.spouse;
      const pick = opts.find((o) => o.id === what) || opts[0];
      const n = (name || '').trim();

      if (to === 'kids') {
        let whatText = pick.id === 'custom' ? clean(whatCustom) : pick.text;
        if (!whatText) whatText = 'I lost my temper with you';
        // "yelled at you" -> "I yelled at you"; a sentence with its own subject ("It got loud") is kept as written.
        const ownSubject = /^(it|we|you|they|he|she|my|the|there|that|this|things)\b/i.test(whatText);
        if (!/^i\b/i.test(whatText)) whatText = (ownSubject ? '' : 'I ') + whatText.charAt(0).toLowerCase() + whatText.slice(1);
        whatText = whatText.replace(/^i\b/, 'I');
        return cap(wrap(KIDS, variant)({ kid: n || 'buddy', what: whatText }));
      }

      let whatText = pick.id === 'custom' ? clean(whatCustom).replace(/^i\s+/i, '') : pick.text;
      if (!whatText) whatText = 'slipped back into an old habit';
      const v = {
        hi: n ? `${n}, ` : 'Hey — ',
        what: whatText,
        feeling: FEELING[feeling] || FEELING.unsure,
        turn: TURN[pick.virtue] || TURN.null,
        need: NEED[need] || NEED.nothing,
      };
      // Capitalise the first letter in case the name was typed lowercase.
      return cap(wrap(SPOUSE, variant)(v));
    },
  };
})();
