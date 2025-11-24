import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const sqlite = new Database('./db.sqlite', { create: true });
sqlite.run('PRAGMA journal_mode = WAL;');

const db = drizzle(sqlite, { schema });

export default db;
