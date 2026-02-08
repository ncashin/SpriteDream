import type { Route } from "./+types/games.$id";
import { useEffect, useRef, useState } from "react";
import { useLoaderData, Link } from "react-router";
import { db, games } from "../db";
import { eq } from "drizzle-orm";

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data?.game ? `${data.game.name} | GameIDE` : "Game Not Found" },
    { name: "description", content: data?.game?.description || "Play this game on GameIDE" },
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
  const [iframeVisible, setIframeVisible] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minRevealDelayMs = 350;

  useEffect(() => {
    setIframeVisible(false);
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, [game.id]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 top-10 bg-[var(--color-bg-base)]">
      {/* Fullscreen game iframe */}
      <iframe
        src={`/api/games/${game.id}/bundle`}
        className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-300 ${iframeVisible ? "opacity-100" : "opacity-0"}`}
        title={game.name}
        allow="fullscreen"
        allowFullScreen
        style={{ display: "block", backgroundColor: "var(--color-bg-base)" }}
        onLoad={() => {
          if (revealTimerRef.current) {
            clearTimeout(revealTimerRef.current);
          }
          revealTimerRef.current = setTimeout(() => {
            setIframeVisible(true);
          }, minRevealDelayMs);
        }}
      />
      {!iframeVisible && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/60 bg-[var(--color-bg-base)]">
          Loading game…
        </div>
      )}

      {/* Info overlay - upper left */}
      <div className="absolute top-4 left-6 pointer-events-none">
        <Link
          to="/explore"
          className="pointer-events-auto inline-flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm group mb-3"
        >
          <i className="codicon codicon-arrow-left w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
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
