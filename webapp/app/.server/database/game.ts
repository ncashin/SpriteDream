import { desc, eq } from "drizzle-orm";

import { gamesTable } from "~/database/schema";
import {
  getDefaultFrontendBundle,
  uploadGameFrontendBundle,
} from "~/.server/storage/gameFrontendBundle";

import { getDatabase } from "./database";

export type CreateGameInput = {
  title: string;
  description?: string | null;
};

export type UpdateGameInput = CreateGameInput & {
  id: string;
};

export async function listGames(env: Env) {
  const database = getDatabase(env);
  return database.select().from(gamesTable).orderBy(desc(gamesTable.id));
}

export async function createGame(env: Env, input: CreateGameInput) {
  const id = crypto.randomUUID();
  const database = getDatabase(env);
  await database.insert(gamesTable).values({ ...input, id });
  await uploadGameFrontendBundle(env, id, getDefaultFrontendBundle(input.title));
  return id;
}

export async function updateGame(env: Env, input: UpdateGameInput) {
  const { id, ...values } = input;
  const database = getDatabase(env);
  await database.update(gamesTable).set(values).where(eq(gamesTable.id, id));
}

export async function deleteGame(env: Env, id: string) {
  const database = getDatabase(env);
  await database.delete(gamesTable).where(eq(gamesTable.id, id));
}

export async function getGameById(env: Env, id: string) {
  const database = getDatabase(env);
  const result = await database
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.id, id));
  return result[0] ?? null;
}
