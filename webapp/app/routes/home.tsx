import { Form, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { createGame, listGames } from "~/.server/database/game";

export function meta({}: Route.MetaArgs) {
  return [{ title: "GameIDE" }, { name: "description", content: "GameIDE" }];
}

export async function loader() {
  const games = await listGames();
  return { games };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const title = formData.get("title");
  const gameTitle =
    typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : "Untitled Game";

  const gameId = await createGame({ title: gameTitle });
  return redirect(`/game/${gameId}`);
}

export default function Home() {
  const { games } = useLoaderData<typeof loader>();

  return (
    <main>
      <div className="flex flex-col gap-4 pt-5 px-4.5">
        <h1>GameIDE</h1>
        <Form method="post">
          <label>
            Game title{" "}
            <input
              type="text"
              name="title"
              placeholder="Untitled Game"
              maxLength={100}
            />
          </label>{" "}
          <button type="submit">Create Game</button>
        </Form>
        <ul >
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
