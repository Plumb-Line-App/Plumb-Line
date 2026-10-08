# Virtue Tracker: From Friction to Freedom

A private, single-page app for tracking the shift from a **Kantian phase** (willpower, restriction, fighting urges) to an **Aristotelian phase** (right action as second nature) in your relationship with food.

## Run it

No build step needed. Either:

- Open `index.html` directly in a browser, or
- Serve the folder: `python3 -m http.server` (or `npm start`) and visit `http://localhost:8000`.

To deploy, publish the folder as-is to any static host (GitHub Pages: Settings → Pages → deploy from branch, root).

## Features

- **Daily Reflection** — pick a stage on the 4-Stage Scale, add a context note, save.
- **Weekly Check-In** — friction slider (1–10), energy focus (restriction vs. initiation), self-compassion response to slips, retrospective note. Submitting plots a new point and returns personalized feedback.
- **Progress** — friction trend line, 30-day stage donut, and a Virtue Stage Insight that places you on the Kant → Aristotle continuum.
- **Data** — everything lives in `localStorage` in this browser only. Use Export/Import (JSON) for backups or moving devices.

## Structure

```
index.html            markup
css/styles.css        component styles
css/tailwind.css      compiled Tailwind utilities (generated)
css/tailwind.src.css  Tailwind input
js/stages.js          4-Stage Scale definitions, date helpers
js/storage.js         localStorage persistence, import/export
js/insights.js        phase scoring, insight + weekly feedback text
js/charts.js          Chart.js line + donut
js/app.js             UI controller
vendor/chart.umd.min.js  Chart.js 4.4.1 (vendored so the app works offline)
```

If you add new Tailwind classes, rebuild the CSS: `npm install && npm run build:css`.

## How the insight is scored

Phase position (0 = Kantian, 100 = Aristotelian) = 70% average stage over the last 30 days + 30% most recent weekly friction (inverted). The trend line compares your last 14 days of logs with the 14 before that (needs 3+ logs in each window).
