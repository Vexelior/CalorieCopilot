import 'server-only';
import { createClient, type Client, type InArgs, type InStatement, type Row } from '@libsql/client';
import { SCHEMA } from './schema';

/**
 * Turso (libSQL) client. Set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in production.
 * Without a URL, development falls back to a local SQLite file (file:local.db).
 */
function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      throw new Error('TURSO_DATABASE_URL is not set. Configure your Turso database URL and auth token.');
    }
    return createClient({ url: 'file:local.db' });
  }
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
}

const globalForDb = globalThis as unknown as { __ccDb?: Client; __ccDbReady?: Promise<void> };

async function getClient(): Promise<Client> {
  globalForDb.__ccDb ??= makeClient();
  // Create the schema once per server instance (statements are idempotent).
  globalForDb.__ccDbReady ??= globalForDb.__ccDb
    .batch(SCHEMA, 'write')
    .then(() => undefined)
    .catch((err) => {
      globalForDb.__ccDbReady = undefined;
      throw err;
    });
  await globalForDb.__ccDbReady;
  return globalForDb.__ccDb;
}

export async function query<T = Row>(sql: string, args: InArgs = []): Promise<T[]> {
  const db = await getClient();
  const rs = await db.execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function queryOne<T = Row>(sql: string, args: InArgs = []): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] ?? null;
}

export async function execute(sql: string, args: InArgs = []) {
  const db = await getClient();
  return db.execute({ sql, args });
}

/** Runs statements atomically (single transaction). */
export async function transaction(statements: InStatement[]) {
  const db = await getClient();
  return db.batch(statements, 'write');
}
