import { useLoaderData } from "react-router";
import type { Route } from "./+types/game.$gameId";

import { getGameById } from "~/.server/database/game";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data.game.title }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const game = await getGameById(context.cloudflare.env, params.gameId);
  if (!game) {
    throw new Response("Game not found", { status: 404 });
  }

  const embedURL = new URL(`/game/${game.id}/embed/`, request.url).toString();

  return { game, embedURL };
}

export default function Game() {
  const { game, embedURL } = useLoaderData<typeof loader>();

  return (
    <main>
      <div className="flex flex-col gap-4 pt-5 px-4.5">
        <h1>{game.title}</h1>
        <p>{game.id}</p>
        <button onClick={() => navigator.clipboard.writeText(embedURL)}>
          {embedURL}
        </button>
        <iframe
          title={`${game.title}`}
          src={embedURL}
          width="800"
          height="450"
        />

        <p>
          <a href="/">Back</a>
        </p>
      </div>
    </main>
  );
}
