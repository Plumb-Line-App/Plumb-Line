# Plumb Line

*"Thus he showed me and behold, the Lord stood beside a wall made by a plumb line, with a plumb line in his hand."* (Amos 7:7, WEB). A plumb line doesn't push the wall; it shows what's true so you can build straight. That's the job of this app: an honest measure, not a verdict.

A private coaching app for becoming a husband his wife is safe with, and later teaching that to his son. It works through five pillars, in order: **Steady**, **Turn toward**, **Understand before fixing**, **Nothing hidden**, **Honor and pursue**. Remove the threat first, then add the warmth.

Every day: one practice from the current pillar, Coach playbooks for hard moments, and a 60-second evening review (an after-action review, not a verdict). Every week: one question to ask her, and a note of what she said. Her read is the real measure.

Underneath, a habits tracker (**Myself**) follows the shift from a **Kantian phase** (willpower, fighting the pull) to an **Aristotelian phase** (right action as second nature) for:

- **Self-control** · with food (classically, temperance)
- **Patience** · with the kids
- **Follow-through** · with work & tasks (classically, diligence)

Scripture is built in at the moments it matters, not added as decoration.

## Run it

No build step needed. Either:

- Open `index.html` directly in a browser, or
- Serve the folder: `python3 -m http.server` (or `npm start`) and visit `http://localhost:8000`.

Live: https://plumb-line-app.github.io/Plumb-Line/ (served from the `gh-pages` branch). It's installable: open it in Safari → Share → Add to Home Screen. After the first load it works offline.

When shipping changes, bump `VERSION` in `sw.js` so installed copies pick them up.

## Layout

Four tabs (a floating bar at the bottom on phones, at the top on desktop). Tabs are hash routes (`#today`, `#script`, `#progress`, `#foundations`) so the back button works; older links (`#honesty`, `#journey`, `#weekly`, `#why`) still land in the right place.

- **Today** — the current pillar (the goal in her words), today's practice, this week's question to ask her, and tonight's review. Below, **Myself** opens the habits tracker: two doors (*An Urge*, *A Slip*), where each habit sits on the path, good acts, plans, and a verse for today.
- **Coach** (`#script`) — eight playbooks for hard moments (she's upset with me, I'm about to snap, I snapped at her, she's overwhelmed…), then **Make it right**: apology and hard-truth wording, and the 15-minute honesty window with its prediction and "how did it go?".
- **Progress** — the five pillars (move on when the practice feels more natural than forced), practices, reviews, evenings you turned toward her, her answers, and the moments that went well; then the habits read-outs, Fear vs. Reality, the weekly check-in, and settings & data.
- **Foundations** — the gentleman (strength under control), the five pillars explained, who you're becoming, and the reading sections (Kant, Aristotle, Aquinas, the capital vices, effort psychology…).

Coaching content lives in `js/coach.js` (pillars, practices, weekly questions, playbooks), so it can be rewritten without touching the app.

## Look

Two themes that follow the phone's light/dark setting: **Morning Light** (warm paper, dawn) and **Sanctuary** (deep night blue, marigold and twilight accents). Settings → Appearance can pin either one. Every colour is a CSS custom property in `css/styles.css`, including the charts, so both themes stay in sync.

## Features

- **Good acts (doing right)** — editable one-tap list, tagged by virtue and by need. "I did it" logs now and asks *how much did it help?* (1–5); "I'm about to" asks what you *expect* first, then compares when you mark it done.
- **Crowding out** — weekly good acts vs. urges & slips. Good acts count toward the phase marker.
- **What did you actually need?** — each pull or slip can name the need underneath (rest, comfort, calm, clarity…). For a pull, the app suggests your good acts that meet that need, sorted by what has helped most.
- **If-then plans** — "When ___, I will ___", per virtue, with an "I did it" that logs the act.
- **Slips & repair** — one tap on *A Slip* logs it, starts the window and opens the Honest Script with words ready. What happened and what you do next are separate. Self-control repairs with your spouse; Patience with the kids and/or your spouse (both can be recorded); Follow-through has no repair step, just a fresh start. Any repair is a double victory.
- **Honesty / repair window** — an un-repaired slip starts a 15-minute countdown (survives reloads; shows in the tab title).
- **Fear vs. reality** — the prediction is saved before the conversation; the outcome is recorded after.
- **Scripture** — anchor verses per virtue (verse for today), plus verses at specific moments: the window (Prov 28:13), repair (Jas 5:16, Eph 4:32), a slip (Rom 8:1), a fresh start (Lam 3:22–23), good acts (Rom 12:21, Gal 6:9), needs (Matt 11:28–30, Ps 34:18, 2 Cor 12:9), weekly feedback, and Foundations. Text is the World English Bible (public domain), extracted verbatim; every verse links to the NIV on BibleGateway. All verses live in `js/scripture.js`, keyed by reference, so the translation can be swapped in one file.
- **Data** — everything lives in `localStorage` in this browser only. Export/Import (JSON) for backups. Older saved data (food-only versions) migrates automatically into Self-control. Internally the virtues keep their original ids (`temperance`, `patience`, `diligence`), so renaming them never touches saved data.

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
js/coach.js            coaching content: pillars, daily practices, weekly questions, playbooks
js/husband.js          coaching UI: today's practice, the weekly question, the evening review, playbooks, pillar progress
js/honesty.js          Coach → Make it right: window, builder, prediction, double victory
js/app.js              app controller (tabs, theme, Progress, weekly check-in, settings, Foundations)
tests/safari/          iPhone 17 checks: WebKit suite + real Mobile Safari (see .github/workflows/safari-qa.yml)
```

If you add new Tailwind classes, rebuild the CSS: `npm install && npm run build:css`.

## Testing on iPhone 17 / Safari

`.github/workflows/safari-qa.yml` (run it from the Actions tab) boots an iPhone 17 simulator on a macOS runner, screenshots every tab of the live site in real Mobile Safari in light and dark, and runs `tests/safari/run.js` (the full flow) and `tests/safari/regress.js` (one check per past bug) in WebKit at 402×874. Results land on the `qa-results` branch. Locally: `npm i --no-save playwright && npx playwright install webkit && BASE=http://localhost:8000/ node tests/safari/run.js`.

## How the insight is scored

Each virtue gets its own phase position (0 = Kantian, 100 = Aristotelian), a weighted blend of whatever has data:

- **50%** average stage of that virtue's pulls over the last 30 days
- **30%** good acts' share of all activity in the last 30 days, `acts / (acts + urges + slips + 2)` — counted once any act has been logged, damped so one act can't swing it
- **20%** that virtue's most recent weekly friction (inverted)

"All virtues" is the average of the active virtues' positions. The trend line compares the last 14 days of pulls with the 14 before (needs 3+ in each window).
