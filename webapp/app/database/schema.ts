import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gameTable = sqliteTable("game", {
  id: text("id").primaryKey().notNull().$default(() => crypto.randomUUID()),
  title: text("title").notNull(),
});
