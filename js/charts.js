// Chart.js wrappers. Charts are created once and updated in place so new data animates in.
(function () {
  let frictionChart = null;
  let stageChart = null;
  let fearChart = null;

  const INK = '#57534e';
  const GRID = '#e7e5e4';
  const LINE = '#5b8aa6';

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
      data: {
        labels: [],
        datasets: [
          {
            label: 'Friction',
            data: [],
            borderColor: LINE,
            backgroundColor: 'rgba(91, 138, 166, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#fff',
            pointBorderColor: LINE,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            min: 1,
            max: 10,
            ticks: { stepSize: 3, callback: (v) => v },
            grid: { color: GRID },
            border: { display: false },
          },
          x: { grid: { display: false }, border: { color: GRID }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (items) => `Week of ${items[0].label}`, label: (i) => ` Friction ${i.parsed.y} / 10` } },
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
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', padding: 12 },
          },
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
          { label: 'Braced for', data: [], backgroundColor: '#c8bcae', borderRadius: 4, maxBarThickness: 22 },
          { label: 'What happened', data: [], backgroundColor: '#5f957f', borderRadius: 4, maxBarThickness: 22 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { min: 0, max: 10, ticks: { stepSize: 2 }, grid: { color: GRID }, border: { display: false } },
          x: { grid: { display: false }, border: { color: GRID }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', padding: 12 } },
          tooltip: { callbacks: { label: (i) => ` ${i.dataset.label}: ${i.parsed.y} / 10` } },
        },
      },
    });
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
    },

    updateFear(pairs) {
      const has = pairs.length > 0;
      document.getElementById('fear-empty').classList.toggle('hidden', has);
      if (!fearChart) return;
      fearChart.data.labels = pairs.map((l) => VT.dates.pretty(l.date));
      fearChart.data.datasets[0].data = pairs.map((l) => l.predicted);
      fearChart.data.datasets[1].data = pairs.map((l) => l.actual);
      fearChart.canvas.style.visibility = has ? 'visible' : 'hidden';
      fearChart.update();
    },

    update(weeklies, stageCounts) {
      const hasWeekly = weeklies.length > 0;
      const hasStages = stageCounts.some((n) => n > 0);
      document.getElementById('friction-empty').classList.toggle('hidden', hasWeekly);
      document.getElementById('stage-empty').classList.toggle('hidden', hasStages);

      if (frictionChart) {
        frictionChart.data.labels = weeklies.map((w) => VT.dates.pretty(w.weekOf));
        frictionChart.data.datasets[0].data = weeklies.map((w) => w.friction);
        frictionChart.canvas.style.visibility = hasWeekly ? 'visible' : 'hidden';
        frictionChart.update();
      }
      if (stageChart) {
        stageChart.data.datasets[0].data = stageCounts;
        stageChart.canvas.style.visibility = hasStages ? 'visible' : 'hidden';
        stageChart.update();
      }
    },
  };
})();
