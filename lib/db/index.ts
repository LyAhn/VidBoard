import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "vidboard.db");

// Singleton — reuse the same connection across hot-reloads in dev.
const globalForDb = globalThis as typeof globalThis & {
  _vidboardDb?: ReturnType<typeof drizzle>;
};

if (!globalForDb._vidboardDb) {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  globalForDb._vidboardDb = drizzle(sqlite, { schema });
}

export const db = globalForDb._vidboardDb;
