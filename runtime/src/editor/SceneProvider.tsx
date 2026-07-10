import { createContext } from "react";
import type { SceneAPI } from "../scene";

export const SceneContext = createContext<SceneAPI | undefined>(undefined);

export default function SceneProvider({
  scene,
  children,
}: {
  scene: SceneAPI;
  children: React.ReactNode;
}) {
  return (
    <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
  );
}
