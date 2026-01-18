import type { Route } from "./+types/games.$id";
import { useLoaderData, Link } from "react-router";
import { db, games } from "../db";
import { eq } from "drizzle-orm";

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data?.game ? `${data.game.name} | Natstack` : "Game Not Found" },
    { name: "description", content: data?.game?.description || "Play this game on Natstack" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const gameId = params.id;

  const [game] = await db
    .select({
      id: games.id,
      name: games.name,
      description: games.description,
      author: games.author,
      hasThumbnail: games.thumbnail,
      createdAt: games.createdAt,
    })
    .from(games)
    .where(eq(games.id, gameId));

  if (!game) {
    throw new Response("Game not found", { status: 404 });
  }

  return {
    game: {
      ...game,
      hasThumbnail: !!game.hasThumbnail,
      formattedDate: new Date(game.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
    },
  };
}

export default function GameDetails() {
  const { game } = useLoaderData<typeof loader>();

  return (
    <div className="fixed inset-0 pt-10">
      {/* Fullscreen game iframe */}
      <iframe
        src={`/api/games/${game.id}/bundle`}
        className="absolute inset-0 w-full h-full border-0"
        title={game.name}
        allow="fullscreen"
        allowFullScreen
      />

      {/* Info overlay - upper left */}
      <div className="absolute top-4 left-6 pointer-events-none">
        <Link
          to="/explore"
          className="pointer-events-auto inline-flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm group mb-3"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        
        <h1 className="text-2xl font-black text-white drop-shadow-lg">{game.name}</h1>
        
        {game.author && (
          <p className="text-white/60 text-sm drop-shadow-md">
            by <span className="text-[var(--color-accent)]">{game.author}</span>
          </p>
        )}
        
        {game.description && (
          <p className="text-white/50 text-sm mt-2 max-w-xs drop-shadow-md">{game.description}</p>
        )}
      </div>
    </div>
  );
}
