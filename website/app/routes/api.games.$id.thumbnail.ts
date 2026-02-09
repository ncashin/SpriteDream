import type { Route } from "./+types/api.games.$id.thumbnail";

// Minimal API route - only queries thumbnail data needed for image serving
// Main game data should be read in games.$id loader
export async function loader({ params }: Route.LoaderArgs) {
  return new Response("Database unavailable", { status: 503 });
}

