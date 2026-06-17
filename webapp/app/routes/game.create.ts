import { createGame } from "~/.server/database/game";

type CreateGameBody = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
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

  const id = await createGame(context.cloudflare.env, { title, description });
  return Response.json({ id });
}
