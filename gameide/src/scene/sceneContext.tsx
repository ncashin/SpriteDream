import { createContext, useContext, type ReactNode } from "react";
import type { Scene } from "./scene.js";

const SceneContext = createContext<Scene | null>(null);

export function SceneProvider({
  scene,
  children,
}: {
  scene: Scene;
  children: ReactNode;
}) {
  return (
    <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
  );
}

export function useScene(): Scene {
  const scene = useContext(SceneContext);
  if (!scene) {
    throw new Error("[gameide] useScene requires SceneProvider");
  }
  return scene;
}
