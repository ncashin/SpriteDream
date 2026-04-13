import { desc, eq } from "drizzle-orm";

import { gamesTable } from "~/database/schema";
import {
  getDefaultFrontendBundle,
  uploadGameFrontendBundle,
} from "~/.server/storage/gameFrontendBundle";

import { database } from "./database";

export type CreateGameInput = {
  title: string;
  description?: string | null;
};

export type UpdateGameInput = CreateGameInput & {
  id: string;
};

export async function listGames() {
  return database.select().from(gamesTable).orderBy(desc(gamesTable.id));
}

export async function createGame(input: CreateGameInput) {
  const id = crypto.randomUUID();
  await database.insert(gamesTable).values({ ...input, id });
  await uploadGameFrontendBundle(id, getDefaultFrontendBundle(input.title));
  return id;
}

export async function updateGame(input: UpdateGameInput) {
  const { id, ...values } = input;
  await database.update(gamesTable).set(values).where(eq(gamesTable.id, id));
}

export async function deleteGame(id: string) {
  await database.delete(gamesTable).where(eq(gamesTable.id, id));
}

export async function getGameById(id: string) {
  const result = await database
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, id));
  return result[0] ?? null;
}
