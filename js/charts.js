// Chart.js wrappers. Charts are created once and updated in place so new data animates in.
(function () {
  let frictionChart = null;
  let stageChart = null;
  let fearChart = null;
  let crowdChart = null;

  const INK = '#57534e';
  const GRID = '#e7e5e4';

  const legendBottom = { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 12 } };
  const barScales = (max) => ({
    y: { min: 0, max, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false } },
    x: { grid: { display: false }, border: { color: GRID }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
  });

  function baseDefaults() {
    if (!window.Chart) return false;
    Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif';
    Chart.defaults.color = INK;
    Chart.defaults.plugins.tooltip.backgroundColor = '#292524';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    return true;
  }

  function initFriction(canvas) {
    frictionChart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        spanGaps: true,
        scales: {
          y: { min: 1, max: 10, ticks: { stepSize: 3 }, grid: { color: GRID }, border: { display: false } },
          x: { grid: { display: false }, border: { color: GRID }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
        },
        plugins: {
          legend: { ...legendBottom, display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Week of ${items[0].label}`,
              label: (i) => ` ${i.dataset.label}: ${i.parsed.y} / 10`,
            },
          },
        },
      },
    });
  }

  function initStages(canvas) {
    stageChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [...VT.STAGES.map((s) => s.short), VT.SLIP.short],
        datasets: [
          {
            data: [0, 0, 0, 0, 0],
            backgroundColor: [...VT.STAGES.map((s) => s.color), VT.SLIP.color],
            borderColor: '#fff',
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { ...legendBottom, labels: { ...legendBottom.labels, pointStyle: 'circle' } },
          tooltip: {
            callbacks: {
              title: (items) => (VT.STAGES[items[0].dataIndex] || VT.SLIP).name,
              label: (i) => {
                const total = i.dataset.data.reduce((a, b) => a + b, 0) || 1;
                return ` ${i.parsed} log${i.parsed === 1 ? '' : 's'} · ${Math.round((i.parsed / total) * 100)}%`;
              },
            },
          },
        },
      },
    });
  }

  function initFear(canvas) {
    fearChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Braced for', data: [], backgroundColor: '#c8bcae', borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 },
          { label: 'What happened', data: [], backgroundColor: '#5f957f', borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: barScales(10),
        plugins: {
          legend: { ...legendBottom, labels: { ...legendBottom.labels, pointStyle: 'rectRounded' } },
          tooltip: { callbacks: { label: (i) => ` ${i.dataset.label}: ${i.parsed.y} / 10` } },
        },
      },
    });
  }

  function initCrowd(canvas) {
    crowdChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Good acts', data: [], backgroundColor: VT.ACT.color, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 },
          { label: 'Urges & slips', data: [], backgroundColor: VT.FIGHT_COLOR, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.85 } },
        scales: barScales(undefined),
        plugins: {
          legend: { ...legendBottom, labels: { ...legendBottom.labels, pointStyle: 'rectRounded' } },
          tooltip: { callbacks: { title: (items) => `Week of ${items[0].label}`, label: (i) => ` ${i.dataset.label}: ${i.parsed.y}` } },
        },
      },
    });
  }

  function setEmpty(id, empty, chart) {
    document.getElementById(id).classList.toggle('hidden', !empty);
    if (chart) chart.canvas.style.visibility = empty ? 'hidden' : 'visible';
  }

  VT.charts = {
    init() {
      if (!baseDefaults()) {
        console.warn('Chart.js failed to load; charts disabled.');
        return;
      }
      initFriction(document.getElementById('friction-chart'));
      initStages(document.getElementById('stage-chart'));
      initFear(document.getElementById('fear-chart'));
      initCrowd(document.getElementById('crowd-chart'));
    },

    resize() {
      [frictionChart, stageChart, fearChart, crowdChart].forEach((c) => c && c.resize());
    },

    // One line per virtue shown; a week without a score for a virtue is a gap, bridged.
    updateFriction(weeklies, virtueIds) {
      const rows = weeklies.filter((w) => virtueIds.some((id) => w.frictions[id] != null));
      setEmpty('friction-empty', !rows.length, frictionChart);
      if (!frictionChart) return;
      frictionChart.data.labels = rows.map((w) => VT.dates.pretty(w.weekOf));
      frictionChart.data.datasets = virtueIds.map((id) => {
        const v = VT.virtueById(id);
        return {
          label: v.name,
          data: rows.map((w) => (w.frictions[id] != null ? w.frictions[id] : null)),
          borderColor: v.color,
          backgroundColor: v.color,
          borderDash: v.dash,
          pointStyle: v.pointStyle,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        };
      });
      frictionChart.options.plugins.legend.display = virtueIds.length > 1;
      frictionChart.update();
    },

    updateStages(counts) {
      setEmpty('stage-empty', !counts.some((n) => n > 0), stageChart);
      if (!stageChart) return;
      stageChart.data.datasets[0].data = counts;
      stageChart.update();
    },

    updateCrowd(weeks) {
      setEmpty('crowd-empty', !weeks.some((w) => w.acts || w.fights), crowdChart);
      if (!crowdChart) return;
      crowdChart.data.labels = weeks.map((w) => VT.dates.pretty(w.weekOf));
      crowdChart.data.datasets[0].data = weeks.map((w) => w.acts);
      crowdChart.data.datasets[1].data = weeks.map((w) => w.fights);
      crowdChart.update();
    },

    updateFear(pairs) {
      setEmpty('fear-empty', !pairs.length, fearChart);
      if (!fearChart) return;
      fearChart.data.labels = pairs.map((l) => VT.dates.pretty(l.date));
      fearChart.data.datasets[0].data = pairs.map((l) => l.predicted);
      fearChart.data.datasets[1].data = pairs.map((l) => l.actual);
      fearChart.update();
    },
  };
})();
