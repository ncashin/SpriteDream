// SceneProvider.tsx

import { createContext, useEffect, useMemo } from "react";
import type { GameContext } from "../initialization";
import { SceneStore } from "../sceneStore";

export const SceneContext = createContext<SceneStore | undefined>(undefined);

export default function GameIDEContextProvider({
  gameContext,
  children,
}: {
  gameContext: GameContext;
  children: React.ReactNode;
}) {
  const { scene, onUpdate } = gameContext;
  const store = useMemo(() => new SceneStore(scene), [scene]);

  useEffect(() => onUpdate(() => store.tick()), [store, onUpdate]);

  return <SceneContext.Provider value={store}>{children}</SceneContext.Provider>;
}
