import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GameIDEMode, getMode, setMode } from "../../../lifecycle/mode.js";
import type { Scene, SceneObject } from "../../../scene/scene.js";
import { pickUntitledSceneSavePath } from "./pickSceneSavePath.js";

const STORAGE_KEY = "gameide-scene-file";
const FILES_API = "/gameide/files";

let editorScene: Scene | null = null;
let savedSnapshot = "";

async function listScenePaths(): Promise<string[]> {
  try {
    const listResponse = await fetch(FILES_API);
    if (!listResponse.ok) return [];
    const listPayload = (await listResponse.json()) as { files?: unknown };
    const projectFiles = listPayload.files;
    if (!Array.isArray(projectFiles)) return [];
    return projectFiles
      .filter(
        (filePath): filePath is string =>
          typeof filePath === "string" && filePath.endsWith(".scene"),
      )
      .sort((leftPath, rightPath) => leftPath.localeCompare(rightPath));
  } catch {
    return [];
  }
}

async function refreshScenes(): Promise<void> {
  useSceneFileStore.setState({ scenes: await listScenePaths() });
}

async function readScene(scenePath: string): Promise<SceneObject | null> {
  try {
    const sceneModule = await import(/* @vite-ignore */ `/${scenePath}`);
    return (sceneModule.default ?? {}) as SceneObject;
  } catch {
    return null;
  }
}

function pickPath(scenePaths: string[], preferredScenePath: string): string {
  if (preferredScenePath && scenePaths.includes(preferredScenePath)) {
    return preferredScenePath;
  }
  return scenePaths[0] ?? "";
}

function syncDirty(): void {
  if (!editorScene) return;
  const isDirty = JSON.stringify(editorScene.getRaw()) !== savedSnapshot;
  if (useSceneFileStore.getState().dirty !== isDirty) {
    useSceneFileStore.setState({ dirty: isDirty });
  }
}

async function openScene(scenePath: string): Promise<boolean> {
  if (!editorScene || !scenePath) return false;
  const sceneData = await readScene(scenePath);
  if (!sceneData) return false;
  editorScene.replace(sceneData);
  savedSnapshot = JSON.stringify(sceneData);
  syncDirty();
  return true;
}

function openNewScene(): void {
  editorScene?.replace({});
  savedSnapshot = JSON.stringify({});
  useSceneFileStore.setState({
    isUntitled: true,
    activeScenePath: "",
    dirty: false,
  });
}

type SceneFileStore = {
  activeScenePath: string;
  isUntitled: boolean;
  scenes: string[];
  dirty: boolean;
  switchScene: (scenePath: string) => Promise<void>;
  save: () => Promise<void>;
  createScene: () => void;
};

export const useSceneFileStore = create<SceneFileStore>()(
  persist(
    (set, getState) => ({
      activeScenePath: "",
      isUntitled: false,
      scenes: [],
      dirty: false,

      switchScene: async (scenePath) => {
        const store = getState();
        if (!scenePath || (!store.isUntitled && scenePath === store.activeScenePath)) {
          return;
        }
        set({ activeScenePath: scenePath, isUntitled: false });
        await openScene(scenePath);
      },

      save: async () => {
        const store = getState();
        if (!editorScene || !store.dirty) return;

        let savePath = store.activeScenePath;
        const wasUntitled = store.isUntitled;
        if (wasUntitled) {
          savePath = pickUntitledSceneSavePath(store.scenes) ?? "";
          if (!savePath) return;
        }
        if (!savePath) return;

        const saveResponse = await fetch(FILES_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: savePath,
            content: editorScene.getRaw(),
          }),
        });
        if (!saveResponse.ok) return;

        savedSnapshot = JSON.stringify(editorScene.getRaw());
        set({
          dirty: false,
          isUntitled: false,
          activeScenePath: savePath,
        });
        await refreshScenes();
      },

      createScene: () => {
        const store = getState();
        if (
          store.dirty &&
          !window.confirm("Discard unsaved changes and create a new scene?")
        ) {
          return;
        }
        if (getMode() === GameIDEMode.Game) setMode(GameIDEMode.Editor);
        openNewScene();
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) =>
        state.isUntitled ? {} : { activeScenePath: state.activeScenePath },
    },
  ),
);

export async function initializeSceneFileStore(scene: Scene): Promise<void> {
  editorScene = scene;
  await useSceneFileStore.persist.rehydrate();

  const scenePaths = await listScenePaths();
  const activeScenePath = pickPath(
    scenePaths,
    useSceneFileStore.getState().activeScenePath,
  );

  useSceneFileStore.setState({ scenes: scenePaths });

  if (activeScenePath && (await openScene(activeScenePath))) {
    useSceneFileStore.setState({
      activeScenePath,
      isUntitled: false,
      dirty: false,
    });
  } else {
    openNewScene();
  }

  editorScene.onChange(syncDirty);
}
