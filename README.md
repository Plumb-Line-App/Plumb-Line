# Virtue Tracker: From Friction to Freedom

A private, single-page app for tracking the shift from a **Kantian phase** (willpower, restriction, fighting the pull) to an **Aristotelian phase** (right action as second nature) across several virtues:

- **Temperance** · with food
- **Patience** · with the kids
- **Diligence** · with work & tasks

Scripture is built in at the moments it matters, not added as decoration.

## Run it

No build step needed. Either:

- Open `index.html` directly in a browser, or
- Serve the folder: `python3 -m http.server` (or `npm start`) and visit `http://localhost:8000`.

Live: https://dmvanblaircom.github.io/Virtue-Tracker/ (served from the `gh-pages` branch). It's installable: open it in Safari → Share → Add to Home Screen. After the first load it works offline.

When shipping changes, bump `VERSION` in `sw.js` so installed copies pick them up.

## Layout

Five tabs (bottom bar on phones, top tabs on desktop). Tabs are hash routes (`#today`, `#honesty`, …) so the back button works.

- **Today** — one path per active virtue (tap to switch), verse for today, one-tap good acts, if-then plans, and the pull/slip log.
- **Honesty** — repair script (spouse or kids), double victories, fear vs. reality.
- **Journey** — filter by virtue; phase insight, crowding-out chart, friction lines, stage donut, what actually helps, history, settings & data.
- **Weekly** — friction per virtue, energy focus (pre-filled from logs), self-compassion, retrospective, feedback with a matched verse.
- **Why** — the synthesis, scripture and the path, Aquinas, capital vices → virtues, Kant, Aristotle, duties, wu-wei, effort psychology.

## Features

- **Good acts (doing right)** — editable one-tap list, tagged by virtue and by need. "I did it" logs now and asks *how much did it help?* (1–5); "I'm about to" asks what you *expect* first, then compares when you mark it done.
- **Crowding out** — weekly good acts vs. urges & slips. Good acts count toward the phase marker.
- **What did you actually need?** — each pull or slip can name the need underneath (rest, comfort, calm, clarity…). For a pull, the app suggests your good acts that meet that need, sorted by what has helped most.
- **If-then plans** — "When ___, I will ___", per virtue, with an "I did it" that logs the act.
- **Slips & repair** — what happened and what you do next are separate. Temperance repairs with your spouse; Patience with the kids and/or your spouse (both can be recorded); Diligence has no repair step, just a fresh start. Any repair is a double victory.
- **Honesty / repair window** — an un-repaired slip starts a 15-minute countdown (survives reloads; shows in the tab title).
- **Fear vs. reality** — the prediction is locked before the conversation; the outcome is recorded after.
- **Scripture** — anchor verses per virtue (verse for today), plus verses at specific moments: the window (Prov 28:13), repair (Jas 5:16, Eph 4:32), a slip (Rom 8:1), a fresh start (Lam 3:22–23), good acts (Rom 12:21, Gal 6:9), needs (Matt 11:28–30, Ps 34:18, 2 Cor 12:9), weekly feedback, and the Why tab. Text is the World English Bible (public domain), extracted verbatim; every verse links to the NIV on BibleGateway. All verses live in `js/scripture.js`, keyed by reference, so the translation can be swapped in one file.
- **Data** — everything lives in `localStorage` in this browser only. Export/Import (JSON) for backups. Older saved data (food-only versions) migrates automatically into Temperance.

## Structure

```
index.html             markup
css/styles.css         component styles
css/tailwind.css       compiled Tailwind utilities (generated)
js/stages.js           4-stage scale, needs, date & copy helpers
js/virtues.js          virtue definitions, repair targets, default good acts
js/scripture.js        verses (WEB, verbatim) and where each is used
js/storage.js          localStorage persistence, migration, import/export
js/insights.js         phase scoring, good-act analytics, honesty stats, feedback copy
js/script.js           repair script templates (spouse + kids)
js/charts.js           Chart.js charts
js/ui.js               shared DOM helpers
js/today.js            Today tab controller
js/app.js              app controller (tabs, banner, Journey, Weekly, settings)
vendor/chart.umd.min.js  Chart.js 4.4.1 (vendored so the app works offline)
```

If you add new Tailwind classes, rebuild the CSS: `npm install && npm run build:css`.

## How the insight is scored

Each virtue gets its own phase position (0 = Kantian, 100 = Aristotelian), a weighted blend of whatever has data:

- **50%** average stage of that virtue's pulls over the last 30 days
- **30%** good acts' share of all activity in the last 30 days, `acts / (acts + urges + slips + 2)` — counted once any act has been logged, damped so one act can't swing it
- **20%** that virtue's most recent weekly friction (inverted)

"All virtues" is the average of the active virtues' positions. The trend line compares the last 14 days of pulls with the 14 before (needs 3+ in each window).
