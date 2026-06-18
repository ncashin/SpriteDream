import { getGameById } from "~/.server/database/game";
import { readGameThumbnail } from "~/.server/storage/gameThumbnail";
import { isValidGameId } from "../../shared/gameId";

import type { Route } from "./+types/game.thumbnail.$id";

export async function loader({ params, context }: Route.LoaderArgs) {
  const id = params.id?.trim();
  if (!id || !isValidGameId(id)) {
    throw new Response(null, { status: 404 });
  }

  const game = await getGameById(context.cloudflare.env, id);
  if (!game?.thumbnailContentType) {
    throw new Response(null, { status: 404 });
  }

  const thumbnail = await readGameThumbnail(context.cloudflare.env, id);
  if (!thumbnail) {
    throw new Response(null, { status: 404 });
  }

  return new Response(thumbnail.content, {
    headers: {
      "Content-Type": game.thumbnailContentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
