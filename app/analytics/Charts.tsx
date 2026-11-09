'use client';

import { useEffect, useRef } from 'react';
import type { Chart as ChartType, ChartConfiguration } from 'chart.js';

export interface ChartData {
  goal: number;
  labels: string[];
  calories: number[];
  logged: boolean[];
  macros: [number, number, number];
  macroGrams: [number, number, number];
  meals: { name: string; kcal: number }[];
  weightUnit: string;
  weights: { date: string; value: number }[];
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function palette() {
  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return {
    brand: css('--viz-brand'), s1: css('--viz-1'), s2: css('--viz-2'), s3: css('--viz-3'), s4: css('--viz-4'),
    goal: css('--viz-goal'), grid: css('--viz-grid'), text: css('--viz-text'), card: css('--bs-body-bg'),
  };
}

type Pal = ReturnType<typeof palette>;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function axes(c: Pal, horizontal = false) {
  const value = { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.text, callback: (v: string | number) => fmt(Number(v)) }, border: { display: false } };
  const category = { grid: { display: false }, ticks: { color: c.text, maxRotation: 0, autoSkipPadding: 12 }, border: { color: c.grid } };
  return horizontal ? { x: value, y: category } : { x: category, y: value };
}

const tooltip = { padding: 10, cornerRadius: 8, boxPadding: 4 };

interface Configs {
  caloriesChart: ChartConfiguration<'bar' | 'line', number[], string>;
  macroChart: ChartConfiguration<'doughnut', number[], string>;
  mealChart: ChartConfiguration<'bar', number[], string>;
  weightChart: ChartConfiguration<'line', number[], string>;
}

function configs(data: ChartData, c: Pal): Configs {
  const macroTotal = data.macros.reduce((a, b) => a + b, 0) || 1;
  const mealTotal = data.meals.reduce((a, m) => a + m.kcal, 0) || 1;
  const values = data.weights.map((w) => w.value);
  const base = { responsive: true, maintainAspectRatio: false, animation: reducedMotion() ? (false as const) : { duration: 400 } };

  return {
    caloriesChart: {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          { type: 'bar', label: 'Eaten', data: data.calories, backgroundColor: c.brand, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', maxBarThickness: 28, categoryPercentage: 0.8, barPercentage: 0.9 },
          { type: 'line', label: 'Goal', data: data.labels.map(() => data.goal), borderColor: c.goal, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHitRadius: 0, tension: 0 },
        ],
      },
      options: {
        ...base,
        interaction: { mode: 'index', intersect: false },
        scales: axes(c),
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltip,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y ?? 0)} kcal`,
              afterBody: (items) => {
                const i = items[0].dataIndex;
                if (!data.logged[i]) return 'Nothing logged';
                const diff = data.calories[i] - data.goal;
                return diff > 0 ? `${fmt(diff)} kcal over goal` : `${fmt(-diff)} kcal under goal`;
              },
            },
          },
        },
      },
    },
    macroChart: {
      type: 'doughnut',
      data: { labels: ['Protein', 'Carbs', 'Fat'], datasets: [{ data: data.macros, backgroundColor: [c.s1, c.s2, c.s3], borderColor: c.card, borderWidth: 2, hoverOffset: 4 }] },
      options: {
        ...base, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltip, callbacks: { label: (ctx) => `${ctx.label}: ${data.macroGrams[ctx.dataIndex]} g · ${Math.round((Number(ctx.parsed) / macroTotal) * 100)}% of kcal` } },
        },
      },
    },
    mealChart: {
      type: 'bar',
      data: {
        labels: data.meals.map((m) => m.name),
        datasets: [{ label: 'Calories', data: data.meals.map((m) => m.kcal), backgroundColor: [c.s1, c.s2, c.s3, c.s4], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 }],
      },
      options: {
        ...base, indexAxis: 'y', scales: axes(c, true),
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltip, displayColors: false, callbacks: { label: (ctx) => `${fmt(ctx.parsed.x ?? 0)} kcal · ${Math.round(((ctx.parsed.x ?? 0) / mealTotal) * 100)}%` } },
        },
      },
    },
    weightChart: {
      type: 'line',
      data: {
        labels: data.weights.map((w) => w.date),
        datasets: [{
          label: 'Weight', data: values, borderColor: c.brand, backgroundColor: c.brand, borderWidth: 2,
          pointRadius: values.length > 20 ? 0 : 4, pointHoverRadius: 6, pointBorderColor: c.card, pointBorderWidth: 2, tension: 0.25,
        }],
      },
      options: {
        ...base,
        interaction: { mode: 'index', intersect: false },
        scales: {
          ...axes(c),
          y: {
            beginAtZero: false, suggestedMin: Math.min(...values) - 1, suggestedMax: Math.max(...values) + 1,
            grid: { color: c.grid }, ticks: { color: c.text, callback: (v) => Number(v).toFixed(1) }, border: { display: false },
          },
        },
        plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (ctx) => `${(ctx.parsed.y ?? 0).toFixed(1)} ${data.weightUnit}` } } },
      },
    },
  };
}

/** Renders every <canvas> whose id matches a chart in `configs`, and redraws on theme change. */
export function Charts({ data }: { data: ChartData }) {
  const charts = useRef<ChartType[]>([]);

  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      const { default: Chart } = await import('chart.js/auto');
      if (cancelled) return;
      charts.current.splice(0).forEach((ch) => ch.destroy());
      const c = palette();
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = c.text;
      for (const [id, config] of Object.entries(configs(data, c))) {
        const el = document.getElementById(id) as HTMLCanvasElement | null;
        if (el) charts.current.push(new Chart(el, config as ChartConfiguration));
      }
    };
    void build();
    const onTheme = () => void build();
    document.addEventListener('cc:themechange', onTheme);
    return () => {
      cancelled = true;
      document.removeEventListener('cc:themechange', onTheme);
      charts.current.splice(0).forEach((ch) => ch.destroy());
    };
  }, [data]);

  return null;
}
