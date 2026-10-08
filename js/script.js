// Disclosure script generator: vulnerability first, ownership without self-punishment, one clear ask.
(function () {
  const WHAT = {
    more: 'ate more than I meant to',
    escape: 'ate to get away from a hard feeling',
    secret: 'ate in secret',
    hid: 'hid food from you',
    nearly: 'slipped with food, and my first instinct was to keep it from you',
  };

  const FEELING = {
    down: 'really down',
    stressed: 'stressed',
    lonely: 'lonely',
    tired: 'worn out',
    anxious: 'anxious',
    numb: 'kind of numb',
    unsure: 'off — I’m honestly not sure what it was',
  };

  const NEED = {
    nothing: 'You don’t need to do anything. I just didn’t want to hide it from you.',
    listen: 'Could you just listen for a minute when you have a chance? I don’t need it fixed.',
    hug: 'Honestly, I could use a hug.',
    plan: 'Would you help me think through tomorrow so I have a better plan?',
  };

  // Each template takes { name, what, feeling, need } and returns the message.
  const TEMPLATES = [
    (v) =>
      `${v.hi}this is hard to say, but I don’t want to hide it from you. Earlier I ${v.what}. I was feeling ${v.feeling}, and I reached for food instead of reaching for you. ${v.need}`,
    (v) =>
      `${v.hi}I’m telling you this because keeping it to myself is the part that actually hurts us. I ${v.what} today. I think I was ${v.feeling}. I’m working on it, and being honest with you is part of that. ${v.need}`,
    (v) =>
      `${v.hi}can I tell you something hard? I ${v.what}. I was ${v.feeling}. I’d rather you hear it from me than have me carry it alone. ${v.need}`,
    (v) =>
      `${v.hi}I’m practicing not hiding things from you, so here goes. I ${v.what}. I was ${v.feeling} and fell back on the old habit. I’m not beating myself up — I just want you in this with me. ${v.need}`,
  ];

  VT.script = {
    count: TEMPLATES.length,
    build({ name, what, whatCustom, feeling, need }, variant = 0) {
      let whatText = what === 'custom' ? (whatCustom || '').trim().replace(/^i\s+/i, '').replace(/[.\s]+$/, '') : WHAT[what];
      if (!whatText) whatText = 'slipped with food';
      const n = (name || '').trim();
      const v = {
        hi: n ? `${n}, ` : 'Hey — ',
        what: whatText,
        feeling: FEELING[feeling] || FEELING.unsure,
        need: NEED[need] || NEED.nothing,
      };
      const text = TEMPLATES[((variant % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length](v);
      // Capitalise the first letter in case the name was typed lowercase.
      return text.charAt(0).toUpperCase() + text.slice(1);
    },
  };
})();
