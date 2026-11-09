import 'server-only';
import { randomUUID } from 'node:crypto';
import { execute, queryOne, transaction } from './db';
import type { ActivityLevel, Sex, User, WeightGoal } from './types';

type UserRow = Record<string, unknown>;

const COLUMNS =
  'Id, Email, DisplayName, Sex, BirthDate, HeightCm, WeightKg, ActivityLevel, WeightGoal, DailyCalorieGoal, ' +
  'ProteinGoalG, CarbsGoalG, FatGoalG, TimeZone, UseMetric, CreatedAt';

export const normalizeEmail = (email: string) => email.trim().toUpperCase();

export function mapUser(r: UserRow): User {
  return {
    id: String(r.Id),
    email: String(r.Email),
    displayName: (r.DisplayName as string | null) ?? null,
    sex: (r.Sex as Sex | null) ?? null,
    birthDate: (r.BirthDate as string | null) ?? null,
    heightCm: r.HeightCm == null ? null : Number(r.HeightCm),
    weightKg: r.WeightKg == null ? null : Number(r.WeightKg),
    activityLevel: (r.ActivityLevel as ActivityLevel) ?? 'Moderate',
    weightGoal: (r.WeightGoal as WeightGoal) ?? 'Maintain',
    dailyCalorieGoal: Number(r.DailyCalorieGoal),
    proteinGoalG: Number(r.ProteinGoalG),
    carbsGoalG: Number(r.CarbsGoalG),
    fatGoalG: Number(r.FatGoalG),
    timeZone: String(r.TimeZone ?? 'UTC'),
    useMetric: Number(r.UseMetric) !== 0,
    createdAt: String(r.CreatedAt),
  };
}

export const USER_COLUMNS = COLUMNS;

export async function findUserById(id: string): Promise<User | null> {
  const r = await queryOne<UserRow>(`SELECT ${COLUMNS} FROM Users WHERE Id = ?`, [id]);
  return r ? mapUser(r) : null;
}

export interface Credentials {
  id: string;
  passwordHash: string;
  accessFailedCount: number;
  lockoutEnd: string | null;
}

export async function findCredentialsByEmail(email: string): Promise<Credentials | null> {
  const r = await queryOne<UserRow>(
    'SELECT Id, PasswordHash, AccessFailedCount, LockoutEnd FROM Users WHERE NormalizedEmail = ?',
    [normalizeEmail(email)],
  );
  return r
    ? { id: String(r.Id), passwordHash: String(r.PasswordHash), accessFailedCount: Number(r.AccessFailedCount), lockoutEnd: (r.LockoutEnd as string | null) ?? null }
    : null;
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const r = await queryOne<UserRow>('SELECT PasswordHash FROM Users WHERE Id = ?', [userId]);
  return r ? String(r.PasswordHash) : null;
}

export async function emailInUse(email: string, exceptUserId?: string): Promise<boolean> {
  const r = await queryOne('SELECT Id FROM Users WHERE NormalizedEmail = ? AND Id <> ?', [normalizeEmail(email), exceptUserId ?? '']);
  return r !== null;
}

/** Returns the new user's id, or null if the email is already registered. */
export async function createUser(input: { email: string; displayName: string; passwordHash: string; timeZone: string }): Promise<string | null> {
  const id = randomUUID();
  try {
    await execute(
      'INSERT INTO Users (Id, Email, NormalizedEmail, PasswordHash, DisplayName, TimeZone, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, input.email.trim(), normalizeEmail(input.email), input.passwordHash, input.displayName, input.timeZone, new Date().toISOString()],
    );
  } catch (err) {
    if (String(err).includes('UNIQUE')) return null;
    throw err;
  }
  return id;
}

export async function recordFailedLogin(userId: string, maxAttempts: number, lockoutMinutes: number) {
  await execute(
    `UPDATE Users SET
       LockoutEnd = CASE WHEN AccessFailedCount + 1 >= ? THEN ? ELSE LockoutEnd END,
       AccessFailedCount = CASE WHEN AccessFailedCount + 1 >= ? THEN 0 ELSE AccessFailedCount + 1 END
     WHERE Id = ?`,
    [maxAttempts, new Date(Date.now() + lockoutMinutes * 60_000).toISOString(), maxAttempts, userId],
  );
}

export async function resetFailedLogins(userId: string) {
  await execute('UPDATE Users SET AccessFailedCount = 0, LockoutEnd = NULL WHERE Id = ?', [userId]);
}

type Updatable = Partial<Omit<User, 'id' | 'createdAt'>> & { passwordHash?: string };

const FIELD_COLUMNS: Record<keyof Updatable, string> = {
  email: 'Email',
  displayName: 'DisplayName',
  sex: 'Sex',
  birthDate: 'BirthDate',
  heightCm: 'HeightCm',
  weightKg: 'WeightKg',
  activityLevel: 'ActivityLevel',
  weightGoal: 'WeightGoal',
  dailyCalorieGoal: 'DailyCalorieGoal',
  proteinGoalG: 'ProteinGoalG',
  carbsGoalG: 'CarbsGoalG',
  fatGoalG: 'FatGoalG',
  timeZone: 'TimeZone',
  useMetric: 'UseMetric',
  passwordHash: 'PasswordHash',
};

/** Updates only the given fields. Returns false if a new email collides with another account. */
export async function updateUser(userId: string, fields: Updatable): Promise<boolean> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(fields) as [keyof Updatable, unknown][]) {
    if (value === undefined) continue;
    sets.push(`${FIELD_COLUMNS[key]} = ?`);
    args.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value as string | number | null));
    if (key === 'email') {
      sets.push('NormalizedEmail = ?');
      args.push(normalizeEmail(value as string));
    }
  }
  if (sets.length === 0) return true;
  try {
    await execute(`UPDATE Users SET ${sets.join(', ')} WHERE Id = ?`, [...args, userId]);
  } catch (err) {
    if (String(err).includes('UNIQUE')) return false;
    throw err;
  }
  return true;
}

export async function deleteUserAndData(userId: string) {
  await transaction([
    { sql: 'DELETE FROM FoodEntries WHERE UserId = ?', args: [userId] },
    { sql: 'DELETE FROM WeightLogs WHERE UserId = ?', args: [userId] },
    { sql: 'DELETE FROM Products WHERE OwnerId = ?', args: [userId] },
    { sql: 'DELETE FROM Sessions WHERE UserId = ?', args: [userId] },
    { sql: 'DELETE FROM Users WHERE Id = ?', args: [userId] },
  ]);
}
