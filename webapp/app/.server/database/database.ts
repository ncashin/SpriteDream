import { drizzle } from "drizzle-orm/d1";

export function getDatabase(env: Env) {
  return drizzle(env.DB);
}
