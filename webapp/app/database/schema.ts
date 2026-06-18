import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gamesTable = sqliteTable("games", {
  id: text("id").primaryKey().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailContentType: text("thumbnail_content_type"),
});
