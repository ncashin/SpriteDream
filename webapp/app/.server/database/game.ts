import { desc, eq } from "drizzle-orm";

import { gamesTable } from "~/database/schema";
import {
  getDefaultFrontendBundle,
  uploadGameFrontendBundle,
} from "~/.server/storage/gameFrontendBundle";
import {
  assertValidGameId,
  GameIdConflictError,
  idFromTitle,
  InvalidGameIdError,
} from "../../../shared/gameId";

import { getDatabase } from "./database";

export type CreateGameInput = {
  title: string;
  description?: string | null;
  id?: string;
};

export type UpdateGameInput = {
  id: string;
  title: string;
  description?: string | null;
};

export type CreateGameResult = {
  id: string;
};

async function assertIdAvailable(env: Env, id: string) {
  const existing = await getGameById(env, id);
  if (existing) {
    throw new GameIdConflictError(id);
  }
}

export async function listGames(env: Env) {
  const database = getDatabase(env);
  return database.select().from(gamesTable).orderBy(desc(gamesTable.id));
}

export async function createGame(
  env: Env,
  input: CreateGameInput,
): Promise<CreateGameResult> {
  const id = input.id?.trim()
    ? (assertValidGameId(input.id.trim()), input.id.trim())
    : idFromTitle(input.title);
  await assertIdAvailable(env, id);

  const database = getDatabase(env);
  try {
    await database.insert(gamesTable).values({ ...input, id });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new GameIdConflictError(id);
    }
    throw error;
  }

  await uploadGameFrontendBundle(env, id, getDefaultFrontendBundle(input.title));
  return { id };
}

export async function updateGame(env: Env, input: UpdateGameInput) {
  const { id, ...values } = input;
  const database = getDatabase(env);
  await database.update(gamesTable).set(values).where(eq(gamesTable.id, id));
}

export async function setGameThumbnail(
  env: Env,
  id: string,
  contentType: string,
) {
  const database = getDatabase(env);
  await database
    .update(gamesTable)
    .set({ thumbnailContentType: contentType })
    .where(eq(gamesTable.id, id));
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /unique constraint failed/i.test(error.message)
  );
}

export { GameIdConflictError, InvalidGameIdError };
