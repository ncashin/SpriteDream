import type { Route } from "./+types/api.games.$id.thumbnail";
import { db, games } from "../db";
import { eq } from "drizzle-orm";

// Minimal API route - only queries thumbnail data needed for image serving
// Main game data should be read in games.$id loader
export async function loader({ params }: Route.LoaderArgs) {
  const gameId = params.id;

  const [game] = await db
    .select({
      thumbnail: games.thumbnail,
      thumbnailMimeType: games.thumbnailMimeType,
    })
    .from(games)
    .where(eq(games.id, gameId));

  if (!game || !game.thumbnail) {
    throw new Response("Thumbnail not found", { status: 404 });
  }

  return new Response(new Uint8Array(game.thumbnail), {
    headers: {
      "Content-Type": game.thumbnailMimeType || "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

