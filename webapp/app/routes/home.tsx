import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { listGames } from "~/.server/database/game";
import { getGameBundleURL } from "../../shared/gameId";

export function meta({}: Route.MetaArgs) {
  return [{ title: "GameIDE" }, { name: "description", content: "GameIDE" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const requestURL = new URL(request.url);
  const games = await listGames(context.cloudflare.env);
  return {
    games: games.map((game) => ({
      id: game.id,
      title: game.title,
      bundleURL: getGameBundleURL(game.id, requestURL, context.cloudflare.env),
    })),
  };
}

export default function Home() {
  const { games } = useLoaderData<typeof loader>();

  return (
    <main>
      <div className="flex flex-col gap-4 pt-5 px-4.5">
        <h1>GameIDE</h1>
        <ul>
          {games.map((game) => (
            <li key={game.id}>
              <a href={game.bundleURL}>{game.title}</a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
