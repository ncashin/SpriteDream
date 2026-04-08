import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import invariant from "tiny-invariant";

invariant(process.env.DB_FILE_NAME);
export const database = drizzle(process.env.DB_FILE_NAME);

