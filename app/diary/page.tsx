import type { Metadata } from 'next';
import Link from 'next/link';
import { removeEntry } from '@/app/actions/diary';
import { CalorieRing, MacroBar } from '@/components/CalorieRing';
import { ConfirmForm } from '@/components/forms';
import { requireUser } from '@/lib/auth';
import { addDays, formatDate, guessMeal, hourIn, isIsoDate, todayIn } from '@/lib/dates';
import { getEntries, getRecentFoods } from '@/lib/food';
import { n0, n2 } from '@/lib/format';
import { MEALS, type Meal } from '@/lib/types';
import { AddFoodButton, DatePicker, EditEntryButton, MealMenu, RecentFoodButton } from './DiaryControls';
import { DiaryProvider } from './DiaryProvider';

export const metadata: Metadata = { title: 'Diary' };

const MEAL_ICONS: Record<Meal, string> = { Breakfast: 'bi-sunrise', Lunch: 'bi-sun', Dinner: 'bi-moon-stars', Snack: 'bi-apple' };

export default async function DiaryPage({ searchParams }: PageProps<'/diary'>) {
  const user = await requireUser('/diary');
  const { date: rawDate } = await searchParams;
  const today = todayIn(user.timeZone);
  const date = isIsoDate(rawDate) && rawDate > '2000' && rawDate < '2200' ? rawDate : today;

  const [entries, recent] = await Promise.all([getEntries(user.id, date), getRecentFoods(user.id)]);
  const total = (f: (e: (typeof entries)[number]) => number) => entries.reduce((sum, e) => sum + f(e) * e.servings, 0);
  const consumed = total((e) => e.calories);
  const defaultMeal = date === today ? guessMeal(hourIn(user.timeZone)) : 'Breakfast';
  const label = date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : date === addDays(today, 1) ? 'Tomorrow' : formatDate(date, { weekday: 'long' });

  return (
    <DiaryProvider date={date} defaultMeal={defaultMeal}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h3 mb-0">{label}</h1>
          <div className="text-body-secondary">{formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <div className="d-flex align-items-center gap-1" id="date-nav">
          <Link className="btn btn-outline-secondary" href={`/diary?date=${addDays(date, -1)}`} aria-label="Previous day"><i className="bi bi-chevron-left" /></Link>
          <DatePicker date={date} />
          <Link className="btn btn-outline-secondary" href={`/diary?date=${addDays(date, 1)}`} aria-label="Next day"><i className="bi bi-chevron-right" /></Link>
          {date !== today && <Link className="btn btn-outline-success" href="/diary">Today</Link>}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card p-4 mb-4">
            <div className="d-flex flex-column align-items-center">
              <CalorieRing consumed={consumed} goal={user.dailyCalorieGoal} />
              <div className="d-flex justify-content-around w-100 mt-3 text-center">
                <div><div className="fw-semibold">{n0(user.dailyCalorieGoal)}</div><div className="small text-body-secondary">Goal</div></div>
                <div><div className="fw-semibold">{n0(consumed)}</div><div className="small text-body-secondary">Eaten</div></div>
                <div><div className="fw-semibold">{entries.length}</div><div className="small text-body-secondary">Items</div></div>
              </div>
            </div>
            <hr />
            <MacroBar label="Protein" cls="bg-protein" value={total((e) => e.proteinG)} target={user.proteinGoalG} />
            <MacroBar label="Carbs" cls="bg-carbs" value={total((e) => e.carbsG)} target={user.carbsGoalG} />
            <MacroBar label="Fat" cls="bg-fat" value={total((e) => e.fatG)} target={user.fatGoalG} />
          </div>

          <div className="d-grid gap-2 mb-4">
            <Link className="btn btn-success btn-lg" href={`/scan?date=${date}`}><i className="bi bi-upc-scan" /> Scan a barcode</Link>
            <AddFoodButton className="btn btn-outline-success"><i className="bi bi-plus-lg" /> Add food manually</AddFoodButton>
          </div>

          {recent.length > 0 && (
            <div className="card">
              <div className="card-header fw-semibold"><i className="bi bi-clock-history" /> Quick add from recent</div>
              <div className="list-group list-group-flush">
                {recent.map((f) => (
                  <RecentFoodButton key={`${f.name}|${f.brand ?? ''}`} food={f}>
                    <span className="text-truncate me-2">
                      {f.name}
                      {f.brand && <span className="text-body-secondary small"> · {f.brand}</span>}
                    </span>
                    <span className="badge text-bg-light border">{n0(f.calories)} kcal</span>
                  </RecentFoodButton>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-8">
          {MEALS.map((meal) => {
            const items = entries.filter((e) => e.meal === meal);
            const mealKcal = items.reduce((s, e) => s + e.calories * e.servings, 0);
            return (
              <div className="card meal-card mb-3" id={`meal-${meal.toLowerCase()}`} key={meal}>
                <div className="card-header d-flex align-items-center justify-content-between py-3">
                  <div className="fw-semibold"><i className={`bi ${MEAL_ICONS[meal]} me-1 text-success`} /> {meal}</div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-body-secondary small">{n0(mealKcal)} kcal</span>
                    <MealMenu meal={meal} date={date} />
                    <AddFoodButton meal={meal} className="btn btn-sm btn-success" label={`Add food to ${meal}`}><i className="bi bi-plus-lg" /></AddFoodButton>
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="card-body text-body-secondary small py-3">Nothing logged yet.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {items.map((e) => (
                      <li className="list-group-item d-flex align-items-center gap-3 py-3" key={e.id}>
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-medium text-truncate">
                            {e.name} {e.barcode && <i className="bi bi-upc text-body-secondary" title="Scanned" />}
                          </div>
                          <div className="small text-body-secondary text-truncate">
                            {e.brand && <>{e.brand} · </>}
                            {n2(e.servings)} × {e.servingDescription ?? 'serving'}
                            {' '}· P {n0(e.proteinG * e.servings)} g · C {n0(e.carbsG * e.servings)} g · F {n0(e.fatG * e.servings)} g
                          </div>
                        </div>
                        <div className="text-end fw-semibold text-nowrap">{n0(e.calories * e.servings)} <span className="small text-body-secondary fw-normal">kcal</span></div>
                        <div className="entry-actions d-flex gap-1">
                          <EditEntryButton entry={e} />
                          <ConfirmForm message={`Remove ${e.name} from your diary?`} action={removeEntry}>
                            <input type="hidden" name="id" value={e.id} />
                            <button type="submit" className="btn btn-sm btn-outline-danger" aria-label={`Delete ${e.name}`}><i className="bi bi-trash" /></button>
                          </ConfirmForm>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DiaryProvider>
  );
}
