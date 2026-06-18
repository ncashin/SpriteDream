import { useState } from "react";
import { useLoaderData } from "react-router";

import { listGames } from "~/.server/database/game";
import { getGameBundleURL } from "../../shared/gameId";

import type { Route } from "./+types/explore";

function GameThumbnail({ thumbnailURL }: { thumbnailURL: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(thumbnailURL) && !failed;

  return (
    <div className="relative aspect-video overflow-hidden bg-[var(--color-bg-base)]">
      {showImage ? (
        <img
          src={thumbnailURL!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-800">
          <svg
            className="h-8 w-8 text-white/[0.06]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </div>
      )}
    </div>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Explore Games | GameIDE" },
    {
      name: "description",
      content: "Discover and play games built with GameIDE",
    },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const requestURL = new URL(request.url);
  const games = await listGames(context.cloudflare.env);

  return {
    games: games.map((game) => ({
      id: game.id,
      title: game.title,
      description: game.description ?? "",
      bundleURL: getGameBundleURL(game.id, requestURL, context.cloudflare.env),
      thumbnailURL: game.thumbnailContentType
        ? `/game/thumbnail/${game.id}`
        : null,
    })),
  };
}

export default function Explore() {
  const { games } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[var(--color-bg-void)] px-10 pt-12 pb-12">
      <div className="w-full pt-10">
        {games.length === 0 ? (
          <p className="text-[var(--color-muted)]">No games yet.</p>
        ) : (
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {games.map((game) => (
              <a
                key={game.id}
                href={game.bundleURL}
                className="group block"
              >
                <GameThumbnail thumbnailURL={game.thumbnailURL} />

                <h3 className="mt-1.5 truncate font-medium text-[var(--color-text)]">{game.title}</h3>
                {game.description ? (
                  <p className="mt-0.5 line-clamp-1 text-[var(--color-muted)]">{game.description}</p>
                ) : null}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
