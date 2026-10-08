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

Four tabs (a floating bar at the bottom on phones, at the top on desktop). Tabs are hash routes (`#today`, `#script`, `#progress`, `#foundations`) so the back button works; older links (`#honesty`, `#journey`, `#weekly`, `#why`) still land in the right place.

- **Today** — pick a virtue, then two doors: *An Urge* (stage, the need underneath, a better choice) or *A Slip*. Below: where each virtue sits on the path, one-tap good acts, up next, if-then plans, and a verse for today.
- **Honest Script** — the 15-minute window (a ring that counts down, with a breathing cue), the message builder, your prediction before telling, and the double victory after.
- **Progress** — the phase read-out, Fear vs. Reality, crowding out, the weekly check-in, friction over time, recent entries, what actually helps, and settings & data.
- **Foundations** — who you're becoming, and the reading sections (Kant, Aristotle, Aquinas, the capital vices, effort psychology…).

## Look

Two themes that follow the phone's light/dark setting: **Morning Light** (warm paper, dawn) and **Sanctuary** (deep night blue, marigold and twilight accents). Settings → Appearance can pin either one. Every colour is a CSS custom property in `css/styles.css`, including the charts, so both themes stay in sync.

## Features

- **Good acts (doing right)** — editable one-tap list, tagged by virtue and by need. "I did it" logs now and asks *how much did it help?* (1–5); "I'm about to" asks what you *expect* first, then compares when you mark it done.
- **Crowding out** — weekly good acts vs. urges & slips. Good acts count toward the phase marker.
- **What did you actually need?** — each pull or slip can name the need underneath (rest, comfort, calm, clarity…). For a pull, the app suggests your good acts that meet that need, sorted by what has helped most.
- **If-then plans** — "When ___, I will ___", per virtue, with an "I did it" that logs the act.
- **Slips & repair** — one tap on *A Slip* logs it, starts the window and opens the Honest Script with words ready. What happened and what you do next are separate. Temperance repairs with your spouse; Patience with the kids and/or your spouse (both can be recorded); Diligence has no repair step, just a fresh start. Any repair is a double victory.
- **Honesty / repair window** — an un-repaired slip starts a 15-minute countdown (survives reloads; shows in the tab title).
- **Fear vs. reality** — the prediction is saved before the conversation; the outcome is recorded after.
- **Scripture** — anchor verses per virtue (verse for today), plus verses at specific moments: the window (Prov 28:13), repair (Jas 5:16, Eph 4:32), a slip (Rom 8:1), a fresh start (Lam 3:22–23), good acts (Rom 12:21, Gal 6:9), needs (Matt 11:28–30, Ps 34:18, 2 Cor 12:9), weekly feedback, and Foundations. Text is the World English Bible (public domain), extracted verbatim; every verse links to the NIV on BibleGateway. All verses live in `js/scripture.js`, keyed by reference, so the translation can be swapped in one file.
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
js/charts.js           hand-drawn SVG charts (theme-aware)
js/ui.js               shared DOM helpers
js/today.js            Today tab controller
js/honesty.js          Honest Script tab: window, builder, prediction, double victory
js/app.js              app controller (tabs, theme, Progress, weekly check-in, settings, Foundations)
tests/safari/          iPhone 17 checks: WebKit suite + real Mobile Safari (see .github/workflows/safari-qa.yml)
```

If you add new Tailwind classes, rebuild the CSS: `npm install && npm run build:css`.

## Testing on iPhone 17 / Safari

`.github/workflows/safari-qa.yml` (run it from the Actions tab) boots an iPhone 17 simulator on a macOS runner, screenshots every tab of the live site in real Mobile Safari in light and dark, drives the slip → Honest Script flow through `safaridriver`, and runs `tests/safari/run.js` in WebKit at 402×874. Results land on the `qa-results` branch. Locally: `npm i --no-save playwright && npx playwright install webkit && BASE=http://localhost:8000/ node tests/safari/run.js`.

## How the insight is scored

Each virtue gets its own phase position (0 = Kantian, 100 = Aristotelian), a weighted blend of whatever has data:

- **50%** average stage of that virtue's pulls over the last 30 days
- **30%** good acts' share of all activity in the last 30 days, `acts / (acts + urges + slips + 2)` — counted once any act has been logged, damped so one act can't swing it
- **20%** that virtue's most recent weekly friction (inverted)

"All virtues" is the average of the active virtues' positions. The trend line compares the last 14 days of pulls with the 14 before (needs 3+ in each window).
