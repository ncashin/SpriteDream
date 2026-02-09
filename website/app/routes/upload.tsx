import type { Route } from "./+types/upload";

export async function action({ request }: Route.ActionArgs) {
  return new Response(
    JSON.stringify({ error: "Database unavailable" }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

