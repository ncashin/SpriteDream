import type { Route } from "./+types/explore";
import { Link, useLoaderData } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Explore Games | GameIDE" },
    { name: "description", content: "Discover and play games built with GameIDE" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  return {
    games: [] as Array<{
      id: string;
      name: string;
      description: string | null;
      author: string | null;
      hasThumbnail: boolean;
      createdAt: string | number | Date;
    }>,
  };
}

export default function Explore() {
  const { games } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[var(--color-bg-void)] pt-24 pb-16">
      <div className="w-full px-6">
        {/* Games grid */}
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
      </div>
    </div>
  );
}
