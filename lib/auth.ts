import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { execute, queryOne } from './db';
import { mapUser, USER_COLUMNS } from './users';
import type { User } from './types';

export const SESSION_COOKIE = 'cc_session';
const SESSION_DAYS = 30;

/** Only a SHA-256 of the session token is stored, so a database leak can't be replayed as cookies. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await execute('INSERT INTO Sessions (Id, UserId, ExpiresAt, CreatedAt) VALUES (?, ?, ?, ?)', [
    hashToken(token), userId, expires.toISOString(), new Date().toISOString(),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Secure on HTTPS (always the case on Vercel); plain-http local testing still works.
    secure: (await headers()).get('x-forwarded-proto') === 'https' || process.env.VERCEL === '1',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

/** The signed-in user, or null. Cached for the duration of one request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const cols = USER_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ');
  const row = await queryOne<Record<string, unknown>>(
    `SELECT ${cols} FROM Sessions s JOIN Users u ON u.Id = s.UserId WHERE s.Id = ? AND s.ExpiresAt > ?`,
    [hashToken(token), new Date().toISOString()],
  );
  return row ? mapUser(row) : null;
});

/** Use at the top of protected pages; redirects to sign-in when there's no valid session. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await execute('DELETE FROM Sessions WHERE Id = ?', [hashToken(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Signs out every device (e.g. after a password change), then starts a fresh session here. */
export async function rotateSessions(userId: string) {
  await execute('DELETE FROM Sessions WHERE UserId = ?', [userId]);
  await createSession(userId);
}

/** Opportunistic cleanup of expired sessions. */
export async function purgeExpiredSessions() {
  await execute('DELETE FROM Sessions WHERE ExpiresAt <= ?', [new Date().toISOString()]);
}
