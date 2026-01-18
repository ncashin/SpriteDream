import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

export const games = sqliteTable("games", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  author: text("author"),
  thumbnail: blob("thumbnail", { mode: "buffer" }),
  thumbnailMimeType: text("thumbnail_mime_type"),
  gameBundle: blob("game_bundle", { mode: "buffer" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

