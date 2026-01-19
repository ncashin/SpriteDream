import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

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

// Ensure data directory exists
const dataDir = dirname(dbPath);
mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

// Log database path in development for debugging
if (process.env.NODE_ENV !== "production") {
  console.log(`[DB] Database path: ${dbPath}`);
}

export * from "./schema";

