import type { Metadata } from 'next';
import Link from 'next/link';
import { logWeight } from '@/app/actions/analytics';
import { SubmitButton } from '@/components/forms';
import { requireUser } from '@/lib/auth';
import { addDays, formatDate, todayIn } from '@/lib/dates';
import { getCaloriesByMeal, getDailyTotals, getStreak, getTopFoods } from '@/lib/food';
import { n0 } from '@/lib/format';
import { KG_PER_LB, MEALS } from '@/lib/types';
import { getWeights } from '@/lib/weights';
import { Charts, type ChartData } from './Charts';

export const metadata: Metadata = { title: 'Analytics' };

const RANGES = [7, 30, 90];

export default async function AnalyticsPage({ searchParams }: PageProps<'/analytics'>) {
  const user = await requireUser('/analytics');
  const { days: rawDays } = await searchParams;
  const days = RANGES.includes(Number(rawDays)) ? Number(rawDays) : 30;
  const to = todayIn(user.timeZone);
  const from = addDays(to, -(days - 1));

  const [daily, byMeal, topFoods, weights, streak] = await Promise.all([
    getDailyTotals(user.id, from, to),
    getCaloriesByMeal(user.id, from, to),
    getTopFoods(user.id, from, to),
    getWeights(user.id, from, to),
    getStreak(user.id, to),
  ]);

  const logged = daily.filter((d) => d.entryCount > 0);
  const avg = (f: (d: (typeof daily)[number]) => number) => (logged.length ? logged.reduce((s, d) => s + f(d), 0) / logged.length : 0);
  const avgKcal = avg((d) => d.calories);
  const avgP = avg((d) => d.proteinG);
  const avgC = avg((d) => d.carbsG);
  const avgF = avg((d) => d.fatG);
  const macroKcal = avgP * 4 + avgC * 4 + avgF * 9;
  const share = (kcal: number) => (macroKcal > 0 ? Math.round((kcal / macroKcal) * 100) : 0);
  const onTarget = logged.filter((d) => Math.abs(d.calories - user.dailyCalorieGoal) <= user.dailyCalorieGoal * 0.1).length;
  const unit = user.useMetric ? 'kg' : 'lb';
  const toDisplay = (kg: number) => (user.useMetric ? kg : kg / KG_PER_LB);
  const change = weights.length >= 2 ? weights[weights.length - 1].weightKg - weights[0].weightKg : null;

  const chartData: ChartData = {
    goal: user.dailyCalorieGoal,
    labels: daily.map((d) => formatDate(d.date, days <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' })),
    calories: daily.map((d) => Math.round(d.calories)),
    logged: daily.map((d) => d.entryCount > 0),
    macros: [Math.round(avgP * 4), Math.round(avgC * 4), Math.round(avgF * 9)],
    macroGrams: [Math.round(avgP), Math.round(avgC), Math.round(avgF)],
    meals: MEALS.map((m) => ({ name: m, kcal: Math.round(byMeal[m]) })),
    weightUnit: unit,
    weights: weights.map((w) => ({ date: formatDate(w.date, { month: 'short', day: 'numeric' }), value: Math.round(toDisplay(w.weightKg) * 10) / 10 })),
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h3 mb-0">Analytics</h1>
          <div className="text-body-secondary">{formatDate(from, { month: 'short', day: 'numeric' })} – {formatDate(to, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <div className="btn-group" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link key={r} className={`btn ${r === days ? 'btn-success' : 'btn-outline-success'}`} href={`/analytics?days=${r}`} aria-current={r === days ? 'true' : undefined}>{r} days</Link>
          ))}
        </div>
      </div>

      <div className="row g-3 mb-4">
        <StatTile icon="bi-fire" tone="bg-success-subtle text-success" title="Daily average" value={<>{n0(avgKcal)} <Unit>kcal</Unit></>} note={`Goal ${n0(user.dailyCalorieGoal)} kcal`} />
        <StatTile icon="bi-bullseye" tone="bg-primary-subtle text-primary" title="On target" value={<>{onTarget} <Unit>/ {logged.length} days</Unit></>} note="Within ±10% of goal" />
        <StatTile icon="bi-lightning-charge" tone="bg-warning-subtle text-warning-emphasis" title="Streak" value={<>{streak} <Unit>day{streak === 1 ? '' : 's'}</Unit></>} note="Consecutive days logged" />
        {change != null ? (
          <StatTile icon="bi-speedometer2" tone="bg-info-subtle text-info-emphasis" title="Weight change"
            value={<><i className={`bi ${change < 0 ? 'bi-arrow-down-right' : change > 0 ? 'bi-arrow-up-right' : 'bi-dash'} fs-5`} /> {toDisplay(Math.abs(change)).toFixed(1)} <Unit>{unit}</Unit></>}
            note={`${change < 0 ? 'Lost' : change > 0 ? 'Gained' : 'No change'} over ${weights.length} weigh-ins`} />
        ) : (
          <StatTile icon="bi-speedometer2" tone="bg-info-subtle text-info-emphasis" title="Weight change" value={<span className="text-body-secondary">–</span>} note="Log at least two weigh-ins" />
        )}
      </div>

      {logged.length === 0 && (
        <div className="card p-5 text-center text-body-secondary mb-4">
          <i className="bi bi-bar-chart display-4 mb-2" />
          <p className="mb-3">No entries in this period yet. Charts appear once you start logging.</p>
          <div><Link href="/diary" className="btn btn-success"><i className="bi bi-plus-lg" /> Log your first meal</Link></div>
        </div>
      )}

      <div className="row g-4">
        <div className="col-12">
          <div className="card p-3 p-md-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h6 mb-0">Calories per day</h2>
              <div className="small text-body-secondary d-flex gap-3">
                <span><span className="swatch" style={{ background: 'var(--viz-brand)' }} />Eaten</span>
                <span><span className="swatch" style={{ background: 'transparent', border: '2px dashed var(--viz-goal)', borderRadius: 2 }} />Goal</span>
              </div>
            </div>
            <div className="chart-box"><canvas id="caloriesChart" role="img" aria-label="Bar chart of calories per day against your goal" /></div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card p-3 p-md-4 h-100">
            <h2 className="h6 mb-3">Average macro split</h2>
            <div className="row align-items-center">
              <div className="col-6"><div className="chart-box sm"><canvas id="macroChart" role="img" aria-label="Average macronutrient calorie split" /></div></div>
              <div className="col-6">
                <ul className="list-unstyled mb-0 small">
                  <MacroLegend cls="bg-protein" label="Protein" pct={share(avgP * 4)} grams={avgP} goal={user.proteinGoalG} />
                  <MacroLegend cls="bg-carbs" label="Carbs" pct={share(avgC * 4)} grams={avgC} goal={user.carbsGoalG} />
                  <MacroLegend cls="bg-fat" label="Fat" pct={share(avgF * 9)} grams={avgF} goal={user.fatGoalG} />
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card p-3 p-md-4 h-100">
            <h2 className="h6 mb-3">Calories by meal</h2>
            <div className="chart-box sm"><canvas id="mealChart" role="img" aria-label="Calories by meal" /></div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card p-3 p-md-4 h-100">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h2 className="h6 mb-0">Weight ({unit})</h2>
              <form action={logWeight} className="input-group input-group-sm" style={{ maxWidth: 240 }} data-action="log-weight">
                <input id="LogWeight" name="weight" type="number" step="0.1" min="20" max="1000" className="form-control" placeholder="Today's weight" aria-label={`Today's weight in ${unit}`} required />
                <span className="input-group-text">{unit}</span>
                <SubmitButton className="btn btn-success"><i className="bi bi-plus-lg" /> Log</SubmitButton>
              </form>
            </div>
            {weights.length === 0 ? (
              <div className="text-body-secondary small py-5 text-center">No weigh-ins in this period. Log one above to start your trend line.</div>
            ) : (
              <div className="chart-box sm"><canvas id="weightChart" role="img" aria-label="Weight trend" /></div>
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header fw-semibold py-3"><i className="bi bi-trophy" /> Most logged foods</div>
            {topFoods.length === 0 ? (
              <div className="card-body text-body-secondary small">Nothing logged yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead><tr><th className="ps-3">Food</th><th className="text-end">Times</th><th className="text-end pe-3">kcal</th></tr></thead>
                  <tbody>
                    {topFoods.map((f) => (
                      <tr key={`${f.name}|${f.brand ?? ''}`}>
                        <td className="ps-3 text-truncate" style={{ maxWidth: 200 }}>{f.name} {f.brand && <span className="text-body-secondary small">· {f.brand}</span>}</td>
                        <td className="text-end">{f.timesLogged}</td>
                        <td className="text-end pe-3">{n0(f.totalCalories)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <details className="mt-4">
        <summary className="text-body-secondary small">View daily data as a table</summary>
        <div className="card mt-2">
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead><tr><th className="ps-3">Date</th><th className="text-end">kcal</th><th className="text-end">Protein g</th><th className="text-end">Carbs g</th><th className="text-end pe-3">Fat g</th></tr></thead>
              <tbody>
                {[...daily].reverse().map((d) => (
                  <tr key={d.date} className={d.entryCount === 0 ? 'text-body-secondary' : ''}>
                    <td className="ps-3">{formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td className="text-end">{n0(d.calories)}</td>
                    <td className="text-end">{n0(d.proteinG)}</td>
                    <td className="text-end">{n0(d.carbsG)}</td>
                    <td className="text-end pe-3">{n0(d.fatG)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <Charts data={chartData} />
    </>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="fs-6 fw-normal text-body-secondary">{children}</span>;
}

function StatTile({ icon, tone, title, value, note }: { icon: string; tone: string; title: string; value: React.ReactNode; note: string }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card stat-tile p-3 h-100">
        <div className="d-flex align-items-center gap-2 mb-2 text-body-secondary small"><span className={`icon ${tone}`}><i className={`bi ${icon}`} /></span> {title}</div>
        <div className="value">{value}</div>
        <div className="small text-body-secondary">{note}</div>
      </div>
    </div>
  );
}

function MacroLegend({ cls, label, pct, grams, goal }: { cls: string; label: string; pct: number; grams: number; goal: number }) {
  return (
    <li className="mb-2">
      <span className={`swatch ${cls}`} /><strong>{label}</strong> {pct}%<br />
      <span className="text-body-secondary ms-3">{Math.round(grams)} g / day (goal {goal} g)</span>
    </li>
  );
}
