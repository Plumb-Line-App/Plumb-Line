// Scripture used deliberately at specific moments. Text is the World English Bible (public domain),
// extracted verbatim from the world-english-bible package. Every verse also links to the NIV.
// To switch translations, replace the text in VERSES (keys are references) and TRANSLATION.
(function () {
  VT.TRANSLATION = {
    id: 'WEB',
    name: 'World English Bible',
    notice: 'Scripture quotations are from the World English Bible, which is in the public domain.',
  };

  VT.VERSES = {
    "1 Corinthians 10:13": "No temptation has taken you except what is common to man. God is faithful, who will not allow you to be tempted above what you are able, but will with the temptation also make the way of escape, that you may be able to endure it.",
    "1 Corinthians 6:12": "“All things are lawful for me,” but not all things are expedient. “All things are lawful for me,” but I will not be brought under the power of anything.",
    "Galatians 5:22-23": "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith, gentleness, and self-control. Against such things there is no law.",
    "James 1:19-20": "So, then, my beloved brothers, let every man be swift to hear, slow to speak, and slow to anger; for the anger of man doesn’t produce the righteousness of God.",
    "Proverbs 15:1": "A gentle answer turns away wrath, but a harsh word stirs up anger.",
    "Ephesians 6:4": "You fathers, don’t provoke your children to wrath, but nurture them in the discipline and instruction of the Lord.",
    "Ephesians 4:26-27": "“Be angry, and don’t sin.” Don’t let the sun go down on your wrath, and don’t give place to the devil.",
    "Colossians 3:23-24": "And whatever you do, work heartily, as for the Lord, and not for men, knowing that from the Lord you will receive the reward of the inheritance; for you serve the Lord Christ.",
    "Proverbs 13:4": "The soul of the sluggard desires, and has nothing, but the desire of the diligent shall be fully satisfied.",
    "Ecclesiastes 9:10": "Whatever your hand finds to do, do it with your might; for there is no work, nor plan, nor knowledge, nor wisdom, in Sheol, where you are going.",
    "Proverbs 28:13": "He who conceals his sins doesn’t prosper, but whoever confesses and renounces them finds mercy.",
    "James 5:16": "Confess your offenses to one another, and pray for one another, that you may be healed. The insistent prayer of a righteous person is powerfully effective.",
    "Lamentations 3:22-23": "It is because of Yahweh’s loving kindnesses that we are not consumed, because his compassion doesn’t fail. They are new every morning. Great is your faithfulness.",
    "Romans 8:1": "There is therefore now no condemnation to those who are in Christ Jesus, who don’t walk according to the flesh, but according to the Spirit.",
    "1 John 1:7": "But if we walk in the light, as he is in the light, we have fellowship with one another, and the blood of Jesus Christ, his Son, cleanses us from all sin.",
    "Romans 12:21": "Don’t be overcome by evil, but overcome evil with good.",
    "Ephesians 4:32": "And be kind to one another, tender hearted, forgiving each other, just as God also in Christ forgave you.",
    "Galatians 6:9": "Let’s not be weary in doing good, for we will reap in due season, if we don’t give up.",
    "Matthew 11:28-30": "“Come to me, all you who labor and are heavily burdened, and I will give you rest. Take my yoke upon you, and learn from me, for I am gentle and humble in heart; and you will find rest for your souls. For my yoke is easy, and my burden is light.”",
    "Psalm 34:18": "Yahweh is near to those who have a broken heart, and saves those who have a crushed spirit.",
    "2 Corinthians 12:9": "He has said to me, “My grace is sufficient for you, for my power is made perfect in weakness.” Most gladly therefore I will rather glory in my weaknesses, that the power of Christ may rest on me.",
    "Romans 7:15": "For I don’t know what I am doing. For I don’t practice what I desire to do; but what I hate, that I do.",
    "Hebrews 12:11": "All chastening seems for the present to be not joyous but grievous; yet afterward it yields the peaceful fruit of righteousness to those who have been trained by it.",
    "2 Peter 1:5-7": "Yes, and for this very cause adding on your part all diligence, in your faith supply moral excellence; and in moral excellence, knowledge; and in knowledge, self-control; and in self-control perseverance; and in perseverance godliness; and in godliness brotherly affection; and in brotherly affection, love.",
    "Galatians 5:16": "But I say, walk by the Spirit, and you won’t fulfill the lust of the flesh.",
    "Romans 12:2": "Don’t be conformed to this world, but be transformed by the renewing of your mind, so that you may prove what is the good, well-pleasing, and perfect will of God.",
    "Philippians 4:8": "Finally, brothers, whatever things are true, whatever things are honorable, whatever things are just, whatever things are pure, whatever things are lovely, whatever things are of good report: if there is any virtue and if there is any praise, think about these things.",
    "Psalm 119:11": "I have hidden your word in my heart, that I might not sin against you.",
    "1 Timothy 4:7b-8": "Exercise yourself toward godliness. For bodily exercise has some value, but godliness has value in all things, having the promise of the life which is now, and of that which is to come.",
    // The seven capital vices and their contrary virtues (Why tab)
    "Proverbs 16:18": "Pride goes before destruction, and an arrogant spirit before a fall.",
    "Micah 6:8": "He has shown you, O man, what is good. What does Yahweh require of you, but to act justly, to love mercy, and to walk humbly with your God?",
    "Proverbs 14:30": "The life of the body is a heart at peace, but envy rots the bones.",
    "Romans 12:15": "Rejoice with those who rejoice. Weep with those who weep.",
    "Ephesians 4:31": "Let all bitterness, wrath, anger, outcry, and slander be put away from you, with all malice.",
    "Luke 12:15": "He said to them, “Beware! Keep yourselves from covetousness, for a man’s life doesn’t consist of the abundance of the things which he possesses.”",
    "2 Corinthians 9:7": "Let each man give according as he has determined in his heart, not grudgingly or under compulsion, for God loves a cheerful giver.",
    "1 John 2:16": "For all that is in the world, the lust of the flesh, the lust of the eyes, and the pride of life, isn’t the Father’s, but is the world’s.",
    "Matthew 5:8": "Blessed are the pure in heart, for they shall see God.",
  };

  // Where each verse is used, and why.
  VT.SCRIPTURE = {
    windowOpen: 'Proverbs 28:13', // the pull to hide, right after a slip
    windowClosed: '1 John 1:7', // walking in the light; fellowship with one another
    repairedSpouse: 'James 5:16', // confess to one another, that you may be healed
    repairedKids: 'Ephesians 4:32', // kind, tender hearted, forgiving
    slip: 'Romans 8:1', // no condemnation, at the point of shame
    grace: 'Lamentations 3:22-23', // new every morning
    goodAct: ['Romans 12:21', 'Galatians 6:9'], // overcome evil with good; don't grow weary
    needs: { rest: 'Matthew 11:28-30', comfort: 'Psalm 34:18', courage: '2 Corinthians 12:9' },
    weekly: {
      harder: 'Galatians 6:9',
      shame: 'Romans 8:1',
      initiation: 'Romans 12:21',
      default: 'Hebrews 12:11',
    },
  };

  VT.scripture = {
    text: (ref) => VT.VERSES[ref] || '',
    nivUrl: (ref) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=NIV`,
    // Same verse all day, rotating through a list day by day.
    ofTheDay(refs, dateKey = VT.dates.today()) {
      const n = VT.dates.daysBetween('2026-01-01', dateKey);
      return refs[((n % refs.length) + refs.length) % refs.length];
    },
    pick(refs, seed) {
      return Array.isArray(refs) ? refs[Math.abs(seed) % refs.length] : refs;
    },
    // Fill a <figure data-verse> element (or create one) with the verse, reference and NIV link.
    render(el, ref) {
      el.classList.add('verse');
      el.innerHTML = '<blockquote class="verse-text"></blockquote><figcaption class="verse-ref"><span></span> <span class="verse-tr"></span> \u00b7 <a target="_blank" rel="noopener">Read in NIV</a></figcaption>';
      el.querySelector('.verse-text').textContent = VT.scripture.text(ref);
      el.querySelector('.verse-ref span').textContent = ref;
      el.querySelector('.verse-tr').textContent = VT.TRANSLATION.id;
      el.querySelector('a').href = VT.scripture.nivUrl(ref);
      el.dataset.ref = ref;
      return el;
    },
  };
})();
