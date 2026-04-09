import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import invariant from "tiny-invariant";

function ensureLocalFileDatabase(url: string) {
  if (!url.startsWith("file:")) return;
  const withoutScheme = url.slice("file:".length);
  if (withoutScheme === ":memory:" || withoutScheme.includes(":memory:")) return;

  const filePath = withoutScheme.startsWith("//")
    ? fileURLToPath(url)
    : resolve(withoutScheme);

  mkdirSync(dirname(filePath), { recursive: true });
}

invariant(process.env.DB_FILE_NAME);
const dbURL = process.env.DB_FILE_NAME;
ensureLocalFileDatabase(dbURL);
export const database = drizzle(dbURL);

await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

