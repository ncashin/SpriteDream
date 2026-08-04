import { createContext, useEffect } from "react";
import type { GameContext } from "../tomove/initialization";

export const ReactGameContext = createContext<GameContext | undefined>(undefined);

export default function GameContextProvider({
  gameContext,
  children,
}: {
  gameContext: GameContext;
  children: React.ReactNode;
}) {
  const { sceneStore, onUpdate } = gameContext;

  useEffect(() => onUpdate(() => sceneStore.tick()), [sceneStore, onUpdate]);

  return <ReactGameContext.Provider value={gameContext}>{children}</ReactGameContext.Provider>;
}
