import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const sqlite = new Database('./db2.sqlite', { create: true });
sqlite.exec('PRAGMA journal_mode = WAL;');

const db = drizzle(sqlite, { schema });

export default db;
export { sqlite };
