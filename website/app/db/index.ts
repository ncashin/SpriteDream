import type { Database as BetterSqlite3Database } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { createRequire } from "module";

// Resolve database path - try multiple methods for reliability
let dbPath: string;
try {
  // Method 1: Use import.meta.url (works in ESM)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Go up two levels from app/db to reach website root
  const websiteRoot = resolve(__dirname, "../..");
  dbPath = join(websiteRoot, "data", "gameide.db");
} catch {
  // Method 2: Fallback to process.cwd() (works in most cases)
  dbPath = join(process.cwd(), "data", "gameide.db");
}

let dbError: Error | null = null;
let sqlite: BetterSqlite3Database | null = null;
const require = createRequire(import.meta.url);

// Ensure data directory exists
try {
  const dataDir = dirname(dbPath);
  mkdirSync(dataDir, { recursive: true });
} catch (error) {
  dbError = error instanceof Error ? error : new Error(String(error));
}

if (!dbError) {
  try {
    const module = require("better-sqlite3") as unknown as {
      default?: new (path: string) => BetterSqlite3Database;
    } & (new (path: string) => BetterSqlite3Database);
    const DatabaseConstructor = module.default ?? module;
    sqlite = new DatabaseConstructor(dbPath);
  } catch (error) {
    dbError = error instanceof Error ? error : new Error(String(error));
  }
}

export const db = sqlite ? drizzle(sqlite, { schema }) : null;
export const dbInitError = dbError;

// Log database path in development for debugging
if (process.env.NODE_ENV !== "production") {
  console.log(`[DB] Database path: ${dbPath}`);
  if (dbError) {
    console.warn(`[DB] Database disabled: ${dbError.message}`);
  }
}

export * from "./schema";

