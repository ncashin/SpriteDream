import { createGame } from "~/.server/database/game";
import {
  GameIdConflictError,
  getGameBundleURL,
  InvalidGameIdError,
} from "../../shared/gameId";

type CreateGameBody = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  id?: unknown;
};

export async function action({ request, context }: { request: Request; context: { cloudflare: { env: Env } } }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: CreateGameBody;
  try {
    body = (await request.json()) as CreateGameBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const rawTitle =
    (typeof body.title === "string" ? body.title : "") ||
    (typeof body.name === "string" ? body.name : "");
  const title = rawTitle.trim();
  if (!title) {
    return Response.json({ error: "title or name is required" }, { status: 400 });
  }

  const rawDescription =
    typeof body.description === "string" ? body.description.trim() : "";
  const description = rawDescription.length > 0 ? rawDescription : null;
  const rawId = typeof body.id === "string" ? body.id.trim() : "";

  try {
    const { id } = await createGame(context.cloudflare.env, {
      title,
      description,
      ...(rawId ? { id: rawId } : {}),
    });
    const requestURL = new URL(request.url);
    return Response.json({
      id,
      bundleURL: getGameBundleURL(id, requestURL, context.cloudflare.env),
    });
  } catch (error) {
    if (error instanceof InvalidGameIdError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof GameIdConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
