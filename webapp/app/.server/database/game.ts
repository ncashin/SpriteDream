import { desc, eq } from "drizzle-orm";

import { gameTable } from "~/database/schema";
import {
  getDefaultFrontendBundle,
  uploadGameFrontendBundle,
} from "~/.server/storage/gameFrontendBundle";

import { database } from "./database";

export type CreateGameInput = {
  title: string;
};

export type UpdateGameInput = CreateGameInput & {
  id: string;
};

export async function listGames() {
  return database.select().from(gameTable).orderBy(desc(gameTable.id));
}

export async function createGame(input: CreateGameInput) {
  const id = crypto.randomUUID();
  await database.insert(gameTable).values({ ...input, id });
  await uploadGameFrontendBundle(id, getDefaultFrontendBundle(input.title));
  return id;
}

export async function updateGame(input: UpdateGameInput) {
  const { id, ...values } = input;
  await database.update(gameTable).set(values).where(eq(gameTable.id, id));
}

export async function deleteGame(id: string) {
  await database.delete(gameTable).where(eq(gameTable.id, id));
}

export async function getGameById(id: string) {
  const result = await database
    .select()
    .from(gameTable)
    .where(eq(gameTable.id, id));
  return result[0] ?? null;
}
