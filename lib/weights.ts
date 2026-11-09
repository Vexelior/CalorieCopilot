import 'server-only';
import { execute, query } from './db';
import type { WeightLog } from './types';

export async function upsertWeight(userId: string, date: string, weightKg: number) {
  await execute(
    'INSERT INTO WeightLogs (UserId, LogDate, WeightKg) VALUES (?, ?, ?) ON CONFLICT (UserId, LogDate) DO UPDATE SET WeightKg = excluded.WeightKg',
    [userId, date, weightKg],
  );
}

export async function getWeights(userId: string, from: string, to: string): Promise<WeightLog[]> {
  const rows = await query<Record<string, unknown>>(
    'SELECT LogDate, WeightKg FROM WeightLogs WHERE UserId = ? AND LogDate BETWEEN ? AND ? ORDER BY LogDate',
    [userId, from, to],
  );
  return rows.map((r) => ({ date: String(r.LogDate), weightKg: Number(r.WeightKg) }));
}
