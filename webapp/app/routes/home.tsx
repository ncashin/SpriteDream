import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { listGames } from "~/.server/database/game";

export function meta({}: Route.MetaArgs) {
  return [{ title: "GameIDE" }, { name: "description", content: "GameIDE" }];
}

export async function loader() {
  const games = await listGames();
  return { games };
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
              <a href={`/game/${game.id}`}>{game.title}</a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
