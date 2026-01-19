import type { Route } from "./+types/explore";
import { Link, useLoaderData } from "react-router";
import { db, games } from "../db";
import { desc } from "drizzle-orm";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Explore Games | GameIDE" },
    { name: "description", content: "Discover and play games built with GameIDE" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const allGames = await db
    .select({
      id: games.id,
      name: games.name,
      description: games.description,
      author: games.author,
      hasThumbnail: games.thumbnail,
      createdAt: games.createdAt,
    })
    .from(games)
    .orderBy(desc(games.createdAt));

  return {
    games: allGames.map((g) => ({
      ...g,
      hasThumbnail: !!g.hasThumbnail,
    })),
  };
}

export default function Explore() {
  const { games } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[var(--color-bg-void)] pt-24 pb-16">
      <div className="w-full px-6">
        {/* Games grid */}
        {games.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-elevated)] border border-white/[0.06] flex items-center justify-center mb-6">
              <i className="codicon codicon-game w-10 h-10 text-white/10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No games yet</h2>
            <p className="text-white/40 text-center max-w-md mb-8">
              Be the first to publish a game! Install the GameIDE VS Code extension to get started.
            </p>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=gameide.gameide"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] text-black font-semibold rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352z"/>
              </svg>
              Install Extension
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <Link
                key={game.id}
                to={`/games/${game.id}`}
                className="group bg-[var(--color-bg-elevated)] rounded-2xl overflow-hidden border border-white/[0.04] hover:border-white/[0.1]"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-[var(--color-bg-base)] relative overflow-hidden">
                  {game.hasThumbnail ? (
                    <img
                      src={`/api/games/${game.id}/thumbnail`}
                      alt={game.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)]/5 to-[var(--color-ember)]/5">
                      <i className="codicon codicon-game w-14 h-14 text-white/[0.06]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-white text-base truncate">
                    {game.name}
                  </h3>
                  {game.author && (
                    <p className="text-sm text-white/40 truncate mt-0.5">
                      by {game.author}
                    </p>
                  )}
                  {game.description && (
                    <p className="text-sm text-white/50 mt-2 line-clamp-2">
                      {game.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
