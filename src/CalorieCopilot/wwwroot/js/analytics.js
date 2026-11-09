(function () {
    const data = JSON.parse(document.getElementById('analytics-data').textContent);
    const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const charts = [];
    const fmt = (n) => Math.round(n).toLocaleString();

    function palette() {
        return {
            brand: css('--viz-brand'), s1: css('--viz-1'), s2: css('--viz-2'), s3: css('--viz-3'), s4: css('--viz-4'),
            goal: css('--viz-goal'), grid: css('--viz-grid'), text: css('--viz-text'),
            surface: getComputedStyle(document.body).backgroundColor,
            card: css('--bs-body-bg'),
        };
    }

    function baseOptions(c) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 400 },
            plugins: {
                legend: { display: false },
                tooltip: { padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4 },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: c.text, maxRotation: 0, autoSkipPadding: 12 }, border: { color: c.grid } },
                y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, callback: (v) => fmt(v) }, border: { display: false } },
            },
        };
    }

    function build() {
        charts.splice(0).forEach((ch) => ch.destroy());
        const c = palette();
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.color = c.text;

        // Calories per day (single series) with the goal as a dashed reference line.
        const calCtx = document.getElementById('caloriesChart');
        if (calCtx) {
            charts.push(new Chart(calCtx, {
                data: {
                    labels: data.labels,
                    datasets: [
                        {
                            type: 'bar', label: 'Eaten', data: data.calories,
                            backgroundColor: c.brand, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom',
                            maxBarThickness: 28, categoryPercentage: 0.8, barPercentage: 0.9,
                        },
                        {
                            type: 'line', label: 'Goal', data: data.labels.map(() => data.goal),
                            borderColor: c.goal, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHitRadius: 0, tension: 0,
                        },
                    ],
                },
                options: Object.assign(baseOptions(c), {
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            padding: 10, cornerRadius: 8, boxPadding: 4,
                            callbacks: {
                                label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)} kcal`,
                                afterBody: (items) => {
                                    const i = items[0].dataIndex;
                                    if (!data.logged[i]) return 'Nothing logged';
                                    const diff = data.calories[i] - data.goal;
                                    return diff > 0 ? `${fmt(diff)} kcal over goal` : `${fmt(-diff)} kcal under goal`;
                                },
                            },
                        },
                    },
                }),
            }));
        }

        const doughnutOptions = (unitLabel) => ({
            responsive: true, maintainAspectRatio: false, cutout: '68%',
            animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 400 },
            plugins: {
                legend: { display: false },
                tooltip: { padding: 10, cornerRadius: 8, boxPadding: 4, callbacks: { label: unitLabel } },
            },
        });

        const macroCtx = document.getElementById('macroChart');
        if (macroCtx) {
            const total = data.macros.reduce((a, b) => a + b, 0) || 1;
            charts.push(new Chart(macroCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Protein', 'Carbs', 'Fat'],
                    datasets: [{ data: data.macros, backgroundColor: [c.s1, c.s2, c.s3], borderColor: c.card, borderWidth: 2, hoverOffset: 4 }],
                },
                options: doughnutOptions((ctx) => `${ctx.label}: ${data.macroGrams[ctx.dataIndex]} g · ${Math.round(ctx.parsed / total * 100)}% of kcal`),
            }));
        }

        const mealCtx = document.getElementById('mealChart');
        if (mealCtx) {
            const total = data.meals.reduce((a, m) => a + m.kcal, 0) || 1;
            charts.push(new Chart(mealCtx, {
                type: 'bar',
                data: {
                    labels: data.meals.map((m) => m.name),
                    datasets: [{
                        label: 'Calories', data: data.meals.map((m) => m.kcal),
                        backgroundColor: [c.s1, c.s2, c.s3, c.s4], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22,
                    }],
                },
                options: Object.assign(baseOptions(c), {
                    indexAxis: 'y',
                    scales: {
                        x: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, callback: (v) => fmt(v) }, border: { display: false } },
                        y: { grid: { display: false }, ticks: { color: c.text }, border: { color: c.grid } },
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: (ctx) => `${fmt(ctx.parsed.x)} kcal · ${Math.round(ctx.parsed.x / total * 100)}%` } },
                    },
                }),
            }));
        }

        const weightCtx = document.getElementById('weightChart');
        if (weightCtx) {
            const values = data.weights.map((w) => w.value);
            const opts = baseOptions(c);
            opts.scales.y.beginAtZero = false;
            opts.scales.y.suggestedMin = Math.min(...values) - 1;
            opts.scales.y.suggestedMax = Math.max(...values) + 1;
            opts.scales.y.ticks.callback = (v) => v.toFixed(1);
            opts.interaction = { mode: 'index', intersect: false };
            opts.plugins.tooltip.callbacks = { label: (ctx) => `${ctx.parsed.y.toFixed(1)} ${data.weightUnit}` };
            charts.push(new Chart(weightCtx, {
                type: 'line',
                data: {
                    labels: data.weights.map((w) => w.date),
                    datasets: [{
                        label: 'Weight', data: values, borderColor: c.brand, backgroundColor: c.brand, borderWidth: 2,
                        pointRadius: values.length > 20 ? 0 : 4, pointHoverRadius: 6, pointBorderColor: c.card, pointBorderWidth: 2, tension: 0.25,
                    }],
                },
                options: opts,
            }));
        }
    }

    build();
    document.addEventListener('cc:themechange', build);
})();
