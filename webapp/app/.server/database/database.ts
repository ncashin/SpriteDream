import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";

export const database = drizzle(process.env.DB_FILE_NAME!);

