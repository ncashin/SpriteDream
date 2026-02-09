import type { Route } from "./+types/api.games.$id.download";

// Minimal API route - only queries bundle data needed for download
// Main game data should be read in games.$id loader
export async function loader({ params }: Route.LoaderArgs) {
  return new Response("Database unavailable", { status: 503 });
}

