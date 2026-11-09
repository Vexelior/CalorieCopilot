import 'server-only';
import { execute, query, queryOne, transaction } from './db';
import { addDays } from './dates';
import type { DailyTotals, FoodEntry, Meal, RecentFood, TopFood } from './types';
import { MEALS } from './types';

type Row = Record<string, unknown>;
const COLUMNS = 'Id, EntryDate, Meal, Name, Brand, Barcode, ServingDescription, Servings, Calories, ProteinG, CarbsG, FatG';

const num = (v: unknown) => (v == null ? 0 : Number(v));
const str = (v: unknown) => (v == null ? null : String(v));

function mapEntry(r: Row): FoodEntry {
  return {
    id: num(r.Id),
    entryDate: String(r.EntryDate),
    meal: (MEALS as readonly string[]).includes(String(r.Meal)) ? (r.Meal as Meal) : 'Snack',
    name: String(r.Name),
    brand: str(r.Brand),
    barcode: str(r.Barcode),
    servingDescription: str(r.ServingDescription),
    servings: num(r.Servings),
    calories: num(r.Calories),
    proteinG: num(r.ProteinG),
    carbsG: num(r.CarbsG),
    fatG: num(r.FatG),
  };
}

export type NewEntry = Omit<FoodEntry, 'id'>;

export async function getEntries(userId: string, date: string): Promise<FoodEntry[]> {
  return (await query<Row>(`SELECT ${COLUMNS} FROM FoodEntries WHERE UserId = ? AND EntryDate = ? ORDER BY CreatedAt, Id`, [userId, date])).map(mapEntry);
}

export async function getEntry(userId: string, id: number): Promise<FoodEntry | null> {
  const r = await queryOne<Row>(`SELECT ${COLUMNS} FROM FoodEntries WHERE UserId = ? AND Id = ?`, [userId, id]);
  return r ? mapEntry(r) : null;
}

export async function addEntry(userId: string, e: NewEntry) {
  await execute(
    'INSERT INTO FoodEntries (UserId, EntryDate, Meal, Name, Brand, Barcode, ServingDescription, Servings, Calories, ProteinG, CarbsG, FatG, CreatedAt) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, e.entryDate, e.meal, e.name, e.brand, e.barcode, e.servingDescription, e.servings, e.calories, e.proteinG, e.carbsG, e.fatG, new Date().toISOString()],
  );
}

/** Adds several entries atomically (all or none). */
export async function addEntries(userId: string, entries: NewEntry[]) {
  const now = new Date().toISOString();
  await transaction(entries.map((e) => ({
    sql: 'INSERT INTO FoodEntries (UserId, EntryDate, Meal, Name, Brand, Barcode, ServingDescription, Servings, Calories, ProteinG, CarbsG, FatG, CreatedAt) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userId, e.entryDate, e.meal, e.name, e.brand, e.barcode, e.servingDescription, e.servings, e.calories, e.proteinG, e.carbsG, e.fatG, now],
  })));
}

export async function updateEntry(userId: string, id: number, e: Omit<NewEntry, 'barcode'>) {
  const rs = await execute(
    'UPDATE FoodEntries SET EntryDate = ?, Meal = ?, Name = ?, Brand = ?, ServingDescription = ?, Servings = ?, Calories = ?, ProteinG = ?, CarbsG = ?, FatG = ? ' +
      'WHERE Id = ? AND UserId = ?',
    [e.entryDate, e.meal, e.name, e.brand, e.servingDescription, e.servings, e.calories, e.proteinG, e.carbsG, e.fatG, id, userId],
  );
  return rs.rowsAffected > 0;
}

export async function deleteEntry(userId: string, id: number) {
  await execute('DELETE FROM FoodEntries WHERE Id = ? AND UserId = ?', [id, userId]);
}

/** Totals per day (inclusive). Days with no entries are filled with zeros. */
export async function getDailyTotals(userId: string, from: string, to: string): Promise<DailyTotals[]> {
  const rows = await query<Row>(
    'SELECT EntryDate, SUM(Calories * Servings) AS Calories, SUM(ProteinG * Servings) AS ProteinG, ' +
      'SUM(CarbsG * Servings) AS CarbsG, SUM(FatG * Servings) AS FatG, COUNT(*) AS EntryCount ' +
      'FROM FoodEntries WHERE UserId = ? AND EntryDate BETWEEN ? AND ? GROUP BY EntryDate',
    [userId, from, to],
  );
  const byDate = new Map(rows.map((r) => [String(r.EntryDate), r]));
  const out: DailyTotals[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = byDate.get(d);
    out.push(
      r
        ? { date: d, calories: num(r.Calories), proteinG: num(r.ProteinG), carbsG: num(r.CarbsG), fatG: num(r.FatG), entryCount: num(r.EntryCount) }
        : { date: d, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, entryCount: 0 },
    );
  }
  return out;
}

export async function getCaloriesByMeal(userId: string, from: string, to: string): Promise<Record<Meal, number>> {
  const rows = await query<Row>(
    'SELECT Meal, SUM(Calories * Servings) AS Calories FROM FoodEntries WHERE UserId = ? AND EntryDate BETWEEN ? AND ? GROUP BY Meal',
    [userId, from, to],
  );
  const out = { Breakfast: 0, Lunch: 0, Dinner: 0, Snack: 0 } as Record<Meal, number>;
  for (const r of rows) if (String(r.Meal) in out) out[r.Meal as Meal] = num(r.Calories);
  return out;
}

export async function getTopFoods(userId: string, from: string, to: string, limit = 8): Promise<TopFood[]> {
  const rows = await query<Row>(
    'SELECT Name, Brand, COUNT(*) AS TimesLogged, SUM(Calories * Servings) AS TotalCalories FROM FoodEntries ' +
      'WHERE UserId = ? AND EntryDate BETWEEN ? AND ? GROUP BY Name, Brand ORDER BY TimesLogged DESC, TotalCalories DESC LIMIT ?',
    [userId, from, to, limit],
  );
  return rows.map((r) => ({ name: String(r.Name), brand: str(r.Brand), timesLogged: num(r.TimesLogged), totalCalories: num(r.TotalCalories) }));
}

/** Most recently logged distinct foods, for one-tap re-logging. */
export async function getRecentFoods(userId: string, limit = 8): Promise<RecentFood[]> {
  const rows = await query<Row>(
    'SELECT f.Name, f.Brand, f.ServingDescription, f.Calories, f.ProteinG, f.CarbsG, f.FatG ' +
      'FROM FoodEntries f JOIN (SELECT MAX(Id) AS LastId FROM FoodEntries WHERE UserId = ? GROUP BY Name, IFNULL(Brand, \'\')) g ' +
      'ON f.Id = g.LastId ORDER BY f.Id DESC LIMIT ?',
    [userId, limit],
  );
  return rows.map((r) => ({
    name: String(r.Name), brand: str(r.Brand), servingDescription: str(r.ServingDescription),
    calories: num(r.Calories), proteinG: num(r.ProteinG), carbsG: num(r.CarbsG), fatG: num(r.FatG),
  }));
}

/** Consecutive days (ending today or yesterday) with at least one entry. */
export async function getStreak(userId: string, today: string): Promise<number> {
  const rows = await query<Row>(
    'SELECT DISTINCT EntryDate FROM FoodEntries WHERE UserId = ? AND EntryDate <= ? ORDER BY EntryDate DESC LIMIT 400',
    [userId, today],
  );
  const dates = new Set(rows.map((r) => String(r.EntryDate)));
  let day = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
