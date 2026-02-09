import type { Route } from "./+types/api.games.$id.bundle";

export async function loader({ }: Route.LoaderArgs) {
  return new Response("Database unavailable", { status: 503 });
}
