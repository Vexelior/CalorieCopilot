// Applies the schema to TURSO_DATABASE_URL (or file:local.db). Usage: npm run db:migrate
import { createClient } from '@libsql/client';
import { SCHEMA } from '../lib/schema.ts';

const url = process.env.TURSO_DATABASE_URL?.trim() || 'file:local.db';
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
await client.batch(SCHEMA, 'write');
console.log(`Schema applied to ${url.replace(/\/\/.*@/, '//***@')}`);
client.close();
