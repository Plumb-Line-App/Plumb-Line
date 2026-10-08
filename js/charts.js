// Hand-drawn SVG charts. Colours are CSS custom properties, so the charts follow light/dark without
// re-rendering. Each chart is drawn at its container's real width so text stays a readable size on a phone.
(function () {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const width = (el) => Math.max(260, Math.round(el.clientWidth || 0));

  function empty(el, msg) {
    el.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'chart-empty';
    p.textContent = msg;
    el.appendChild(p);
  }

  // x positions for n points; a single point sits in the middle.
  const xs = (n, left, right) => (i) => (n < 2 ? (left + right) / 2 : left + (i * (right - left)) / (n - 1));

  function axis10(W, P, y) {
    return [1, 4, 7, 10]
      .map(
        (v) =>
          `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" style="stroke: var(--grid)"/>` +
          `<text x="${P.l - 8}" y="${y(v) + 4}" font-size="11" style="fill: var(--axis)" text-anchor="end">${v}</text>`
      )
      .join('');
  }

  VT.charts = {
    // Predicted vs. actual difficulty for each honest conversation; the shaded gap is the cost of fear.
    fear(el, pairs) {
      if (!pairs.length) {
        return empty(el, 'Your first honest conversation will show up here: what you braced for, next to what actually happened.');
      }
      const data = pairs.slice(-12);
      const n = data.length;
      const W = width(el);
      const H = W < 420 ? 200 : 230;
      const P = { l: 26, r: 12, t: 14, b: 26 };
      const x = xs(n, P.l + 8, W - P.r - 8);
      const y = (v) => P.t + ((10 - v) * (H - P.t - P.b)) / 9;
      const line = (k) => data.map((d, i) => `${x(i)},${y(d[k])}`).join(' ');

      let area = '';
      let label = '';
      if (n > 1) {
        const back = data.map((d, i) => `${x(i)},${y(d.actual)}`).reverse().join(' ');
        area = `<polygon points="${line('predicted')} ${back}" fill="url(#vt-gap)"/>`;
        // Label the widest gap where fear ran above reality, if there's room for the words.
        let best = -1;
        let gap = 1.5;
        data.forEach((d, i) => {
          if (d.predicted - d.actual >= gap) {
            gap = d.predicted - d.actual;
            best = i;
          }
        });
        if (best >= 0) {
          const lx = Math.min(Math.max(x(best), P.l + 52), W - P.r - 52);
          const ly = (y(data[best].predicted) + y(data[best].actual)) / 2 + 4;
          label = `<text x="${lx}" y="${ly}" font-size="11.5" style="fill: var(--gap-label)" text-anchor="middle">the cost of fear</text>`;
        }
      }
      const dots = (k, c, name) =>
        data
          .map((d, i) => `<circle cx="${x(i)}" cy="${y(d[k])}" r="4.5" style="fill: var(${c}); stroke: var(--panel)" stroke-width="2"><title>${name}: ${d[k]}/10</title></circle>`)
          .join('');
      const first = n > 1 ? `<text x="${P.l}" y="${H - 6}" font-size="11" style="fill: var(--axis)">${n === pairs.length ? 'First' : 'Earlier'}</text>` : '';
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Predicted versus actual difficulty for ${n} honest conversation${n === 1 ? '' : 's'}">
        <defs><linearGradient id="vt-gap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--c-fear); stop-opacity: .26"/><stop offset="1" style="stop-color: var(--c-real); stop-opacity: .12"/></linearGradient></defs>
        ${axis10(W, P, y)}${area}
        ${n > 1 ? `<polyline points="${line('predicted')}" fill="none" style="stroke: var(--c-fear)" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round"/>` : ''}
        ${n > 1 ? `<polyline points="${line('actual')}" fill="none" style="stroke: var(--c-real)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
        ${dots('predicted', '--c-fear', 'Braced for')}${dots('actual', '--c-real', 'What happened')}${label}
        ${first}<text x="${W - P.r}" y="${H - 6}" font-size="11" style="fill: var(--axis)" text-anchor="end">Latest</text></svg>`;
    },

    // Weekly good acts as the foundation, urges & slips stacked on top.
    crowd(el, weeks) {
      if (!weeks.some((w) => w.acts || w.fights)) {
        return empty(el, 'As you log good acts and pulls, each week stacks up here. Watch the good grow underneath.');
      }
      const W = width(el);
      const H = 170;
      const P = { l: 4, r: 4, t: 18, b: 22 };
      const n = weeks.length;
      const max = Math.max(4, ...weeks.map((w) => w.acts + w.fights));
      const gw = (W - P.l - P.r) / n;
      const bw = Math.min(22, gw * 0.56);
      const base = H - P.b;
      const k = (H - P.t - P.b - 2) / max;
      const bars = weeks
        .map((w, i) => {
          const cx = P.l + gw * i + gw / 2;
          const ha = w.acts * k;
          const hu = w.fights * k;
          const gap = w.acts && w.fights ? 2 : 0;
          const when = VT.dates.pretty(w.weekOf);
          const total = w.acts + w.fights;
          return (
            (w.acts ? `<rect x="${cx - bw / 2}" y="${base - ha}" width="${bw}" height="${ha}" rx="3" style="fill: var(--c-act)"><title>Week of ${when}: ${VT.plural(w.acts, 'good act')}</title></rect>` : '') +
            (w.fights ? `<rect x="${cx - bw / 2}" y="${base - ha - gap - hu}" width="${bw}" height="${hu}" rx="3" style="fill: var(--c-urge)"><title>Week of ${when}: ${VT.plural(w.fights, 'urge or slip', 'urges or slips')}</title></rect>` : '') +
            (total ? `<text x="${cx}" y="${base - ha - gap - hu - 5}" font-size="10" style="fill: var(--axis)" text-anchor="middle">${total}</text>` : '')
          );
        })
        .join('');
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Good acts and urges per week, last ${n} weeks">
        <line x1="${P.l}" x2="${W - P.r}" y1="${base}" y2="${base}" style="stroke: var(--grid)"/>${bars}
        <text x="${P.l}" y="${H - 5}" font-size="10.5" style="fill: var(--axis)">${n - 1} weeks ago</text>
        <text x="${W - P.r}" y="${H - 5}" font-size="10.5" style="fill: var(--axis)" text-anchor="end">This week</text></svg>`;
    },

    // Friction per virtue across weekly check-ins (lower is calmer). Lines differ by colour and dash.
    friction(el, legend, weeklies, ids) {
      legend.innerHTML = '';
      ids.forEach((id) => {
        const v = VT.virtueById(id);
        const span = document.createElement('span');
        span.innerHTML = `<svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke-width="2.5" stroke-linecap="round"/></svg><span></span>`;
        const ln = span.querySelector('line');
        ln.style.stroke = v.color;
        if (v.dash) ln.setAttribute('stroke-dasharray', v.dash);
        span.lastChild.textContent = v.name;
        legend.appendChild(span);
      });
      const rows = weeklies.filter((w) => ids.some((id) => w.frictions[id] != null)).slice(-10);
      if (!rows.length) return empty(el, weeklies.length ? 'No check-ins yet for the virtues you’re working on now.' : 'Your first weekly check-in starts these lines.');
      const n = rows.length;
      const W = width(el);
      const H = 180;
      const P = { l: 26, r: 10, t: 12, b: 26 };
      const x = xs(n, P.l + 8, W - P.r - 8);
      const y = (v) => P.t + ((10 - v) * (H - P.t - P.b)) / 9; // lower friction plots lower
      const grid = axis10(W, P, y);
      const lines = ids
        .map((id) => {
          const v = VT.virtueById(id);
          const pts = rows.map((w, i) => (w.frictions[id] != null ? [x(i), y(w.frictions[id]), w] : null));
          const segs = [];
          let cur = [];
          pts.forEach((p) => {
            if (p) cur.push(`${p[0]},${p[1]}`);
            else if (cur.length) {
              segs.push(cur);
              cur = [];
            }
          });
          if (cur.length) segs.push(cur);
          const dash = v.dash ? ` stroke-dasharray="${v.dash}"` : '';
          return (
            segs.filter((s) => s.length > 1).map((s) => `<polyline points="${s.join(' ')}" fill="none" style="stroke: ${v.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${dash}/>`).join('') +
            pts
              .filter(Boolean)
              .map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill: ${v.color}; stroke: var(--panel)" stroke-width="1.5"><title>${esc(v.name)}, week of ${VT.dates.pretty(p[2].weekOf)}: ${p[2].frictions[id]}/10</title></circle>`)
              .join('')
          );
        })
        .join('');
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Weekly friction per virtue, 1 effortless to 10 exhausting">
        ${grid}${lines}
        <text x="${P.l}" y="${H - 6}" font-size="11" style="fill: var(--axis)">${VT.dates.pretty(rows[0].weekOf)}</text>
        ${n > 1 ? `<text x="${W - P.r}" y="${H - 6}" font-size="11" style="fill: var(--axis)" text-anchor="end">${VT.dates.pretty(rows[n - 1].weekOf)}</text>` : ''}</svg>`;
    },

    // How the last 30 days of pulls were met: the four stages plus slips, as one stacked bar.
    stages(el, counts) {
      const total = counts.reduce((a, b) => a + b, 0);
      if (!total) return empty(el, 'Nothing logged in the last 30 days yet.');
      const parts = VT.STAGES.map((s, i) => ({ name: s.short, color: s.color, n: counts[i] })).concat({ name: 'Slip', color: VT.SLIP.color, n: counts[4] });
      el.innerHTML = '<div class="stagebar" role="img"></div><div class="legend mt-3"></div>';
      const bar = el.firstChild;
      bar.setAttribute('aria-label', parts.map((p) => `${p.name}: ${p.n}`).join(', '));
      const legend = el.lastChild;
      parts.forEach((p) => {
        if (p.n) {
          const i = document.createElement('i');
          i.style.flexGrow = String(p.n);
          i.style.background = p.color;
          i.title = `${p.name}: ${p.n}`;
          bar.appendChild(i);
        }
        const s = document.createElement('span');
        s.innerHTML = '<i class="swatch"></i><span></span>';
        s.firstChild.style.background = p.color;
        s.lastChild.textContent = `${p.name} · ${p.n}`;
        legend.appendChild(s);
      });
    },
  };
})();
