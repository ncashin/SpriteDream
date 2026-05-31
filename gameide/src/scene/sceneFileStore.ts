import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  SCENE_CHANNEL,
  type SceneEditorState,
} from "./sceneChannel/sceneChannel.js";
import type { Scene, SceneObject } from "./scene.js";
import { stripScenePatchSentinels } from "./scene.js";

const STORAGE_KEY = "gameide-scene-file";
const SCENES_API = "/__gameide/scenes";
const SCENE_FILE_API = "/__gameide/scene";

function sceneSnapshot(data: SceneObject): string {
  return JSON.stringify(stripScenePatchSentinels(data));
}

function isEmbeddedInParentFrame(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

async function fetchSceneList(): Promise<string[]> {
  try {
    const res = await fetch(SCENES_API);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

async function fetchSceneFile(
  relativePath: string,
): Promise<SceneObject | null> {
  try {
    const res = await fetch(
      `${SCENE_FILE_API}?path=${encodeURIComponent(relativePath)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as SceneObject;
  } catch {
    return null;
  }
}

function pickActiveScene(
  scenes: readonly string[],
  preferred: string,
): string {
  if (preferred && scenes.includes(preferred)) return preferred;
  return scenes[0] ?? "";
}

function isSceneEditorStateMessage(
  raw: unknown,
): raw is { type: string; content?: unknown } {
  return (
    !!raw &&
    typeof raw === "object" &&
    typeof (raw as { type?: unknown }).type === "string"
  );
}

function parseSceneEditorState(content: unknown): SceneEditorState | null {
  if (!content || typeof content !== "object") return null;
  const state = content as Partial<SceneEditorState>;
  if (typeof state.path !== "string") return null;
  if (typeof state.dirty !== "boolean") return null;
  if (typeof state.saving !== "boolean") return null;
  return { path: state.path, dirty: state.dirty, saving: state.saving };
}

type SceneFileStore = {
  activeScenePath: string;
  scenes: string[];
  dirty: boolean;
  saving: boolean;
  scenesLoaded: boolean;
  setScenes: (scenes: string[]) => void;
  setActiveScenePath: (
    path: string,
    options?: { notifyHost?: boolean },
  ) => void;
  applyHostEditorState: (state: SceneEditorState) => void;
  loadScenes: () => Promise<void>;
  requestSave: () => void;
};

export const useSceneFileStore = create<SceneFileStore>()(
  persist(
    (set, get) => ({
      activeScenePath: "",
      scenes: [],
      dirty: false,
      saving: false,
      scenesLoaded: false,

      setScenes: (scenes) => {
        const activeScenePath = pickActiveScene(scenes, get().activeScenePath);
        set({ scenes, activeScenePath });
      },

      setActiveScenePath: (path, options) => {
        if (!path || path === get().activeScenePath) return;
        set({ activeScenePath: path });
        if (options?.notifyHost === false) return;
        if (!isEmbeddedInParentFrame()) return;
        window.parent.postMessage(
          {
            type: SCENE_CHANNEL.requestSceneSwitch,
            content: path,
          },
          "*",
        );
      },

      applyHostEditorState: (state) => {
        const updates: Pick<SceneFileStore, "dirty" | "saving" | "activeScenePath"> =
          {
            dirty: state.dirty,
            saving: state.saving,
            activeScenePath: get().activeScenePath,
          };

        if (state.path) {
          if (isEmbeddedInParentFrame() || !get().activeScenePath) {
            updates.activeScenePath = state.path;
          }
        }

        set(updates);
      },

      loadScenes: async () => {
        if (get().scenesLoaded) return;
        const scenes = await fetchSceneList();
        const previousPath = get().activeScenePath;
        const activeScenePath = pickActiveScene(scenes, previousPath);
        set({ scenes, activeScenePath, scenesLoaded: true });
      },

      requestSave: () => {
        if (isEmbeddedInParentFrame()) {
          window.parent.postMessage(
            { type: SCENE_CHANNEL.requestSceneSave },
            "*",
          );
          return;
        }
        void saveActiveScene();
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ activeScenePath: state.activeScenePath }),
    },
  ),
);

let boundScene: Scene | null = null;
let savedSnapshot = "";
let applyingExternalUpdate = false;
let unsubscribeOnChange: (() => void) | undefined;
let unsubscribeStore: (() => void) | undefined;

function syncDirtyState(): void {
  if (!boundScene) return;
  useSceneFileStore.setState({
    dirty: sceneSnapshot(boundScene.getRaw()) !== savedSnapshot,
  });
}

async function loadSceneAtPath(relativePath: string): Promise<void> {
  if (!boundScene || !relativePath) return;

  const data = await fetchSceneFile(relativePath);
  if (!data) return;

  applyingExternalUpdate = true;
  try {
    boundScene.replace(data);
    savedSnapshot = sceneSnapshot(data);
  } finally {
    applyingExternalUpdate = false;
  }
  syncDirtyState();
}

async function saveActiveScene(): Promise<void> {
  const { activeScenePath, saving, dirty } = useSceneFileStore.getState();
  if (!boundScene || !activeScenePath || saving || !dirty) return;

  useSceneFileStore.setState({ saving: true });
  try {
    const res = await fetch(SCENE_FILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: activeScenePath,
        content: stripScenePatchSentinels(boundScene.getRaw()),
      }),
    });
    if (!res.ok) throw new Error("Failed to save scene");
    savedSnapshot = sceneSnapshot(boundScene.getRaw());
    useSceneFileStore.setState({ dirty: false });
  } finally {
    useSceneFileStore.setState({ saving: false });
  }
}

export function bindSceneFileStore(
  scene: Scene,
  initialPath?: string,
): () => void {
  boundScene = scene;
  savedSnapshot = sceneSnapshot(scene.getRaw());

  unsubscribeOnChange = scene.onChange(() => {
    if (applyingExternalUpdate || useSceneFileStore.getState().saving) return;
    syncDirtyState();
  });

  unsubscribeStore = useSceneFileStore.subscribe((state, previous) => {
    if (state.activeScenePath === previous.activeScenePath) return;
    if (!state.activeScenePath) return;
    void loadSceneAtPath(state.activeScenePath);
  });

  if (initialPath) {
    void loadSceneAtPath(initialPath);
  } else {
    syncDirtyState();
  }

  return () => {
    unsubscribeOnChange?.();
    unsubscribeStore?.();
    boundScene = null;
  };
}

export async function hydrateSceneFileStore(): Promise<string> {
  await useSceneFileStore.persist.rehydrate();
  return useSceneFileStore.getState().activeScenePath;
}

export function subscribeSceneFileHostState(): () => void {
  function handleHostState(raw: unknown): void {
    if (!isSceneEditorStateMessage(raw)) return;
    if (raw.type !== SCENE_CHANNEL.sceneEditorState) return;

    const state = parseSceneEditorState(raw.content);
    if (!state) return;
    useSceneFileStore.getState().applyHostEditorState(state);
  }

  function onParentMessage(event: MessageEvent): void {
    if (event.source !== window.parent) return;
    handleHostState(event.data);
  }

  window.addEventListener("message", onParentMessage);

  return () => {
    window.removeEventListener("message", onParentMessage);
  };
}
