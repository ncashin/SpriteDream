import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gamesTable = sqliteTable("games", {
  id: text("id").primaryKey().notNull().$default(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
});
