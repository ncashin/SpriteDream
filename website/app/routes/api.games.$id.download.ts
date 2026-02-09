import type { Route } from "./+types/api.games.$id.download";
import { db, games } from "../db";
import { eq } from "drizzle-orm";

// Minimal API route - only queries bundle data needed for download
// Main game data should be read in games.$id loader
export async function loader({ params }: Route.LoaderArgs) {
  const gameId = params.id;

  if (!db) {
    return new Response("Database unavailable", { status: 503 });
  }

  const [game] = await db
    .select({
      name: games.name,
      gameBundle: games.gameBundle,
    })
    .from(games)
    .where(eq(games.id, gameId));

  if (!game || !game.gameBundle) {
    throw new Response("Game not found", { status: 404 });
  }

  const fileName = `${game.name.replace(/[^a-zA-Z0-9]/g, "_")}.zip`;

  return new Response(new Uint8Array(game.gameBundle), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

