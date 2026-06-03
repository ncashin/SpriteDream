import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SCENE_CHANNEL } from "../../../scene/sceneChannel/sceneChannel.js";
import type { Scene, SceneObject } from "../../../scene/scene.js";
import {
  diffScenePatch,
  stripScenePatchSentinels,
} from "../../../scene/scene.js";

const STORAGE_KEY = "gameide-scene-file";
const SCENE_FILE_API = "/gameide/scene";
const SCENE_HMR_EVENT = "gameide:scene-hmr";

function sceneSnapshot(data: SceneObject): string {
  return JSON.stringify(stripScenePatchSentinels(data));
}

function pickActiveScene(scenes: readonly string[], preferred: string): string {
  if (preferred && scenes.includes(preferred)) return preferred;
  return scenes[0] ?? "";
}

function isEmbeddedInParentFrame(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

type SceneFileStore = {
  activeScenePath: string;
  scenes: string[];
  dirty: boolean;
  saving: boolean;
  setScenes: (scenes: string[]) => void;
  setActiveScenePath: (path: string) => void;
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

      setScenes: (scenes) => {
        set({
          scenes,
          activeScenePath: pickActiveScene(scenes, get().activeScenePath),
        });
      },

      setActiveScenePath: (path) => {
        if (!path || path === get().activeScenePath) return;
        set({ activeScenePath: path });
      },

      loadScenes: async () => {
        const mod = await import("gameide:scenes");
        const scenes = Array.isArray(mod.default)
          ? mod.default.filter((entry): entry is string => typeof entry === "string")
          : [];
        get().setScenes(scenes);

        if (import.meta.hot) {
          import.meta.hot.accept("gameide:scenes", (next) => {
            if (!next) return;
            const updated = Array.isArray(next.default)
              ? (next.default as unknown[]).filter(
                  (entry): entry is string => typeof entry === "string",
                )
              : [];
            get().setScenes(updated);
          });
        }
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
let unsubscribeSceneHmr: (() => void) | undefined;

function onSceneHmr(event: Event): void {
  if (!boundScene) return;
  const detail = (event as CustomEvent<{ path?: unknown; data?: unknown }>).detail;
  if (!detail || typeof detail.path !== "string" || !detail.data || typeof detail.data !== "object") {
    return;
  }
  const { activeScenePath } = useSceneFileStore.getState();
  if (detail.path !== activeScenePath) return;

  const data = stripScenePatchSentinels(detail.data as SceneObject);
  const patch = diffScenePatch(boundScene.getRaw(), data);

  applyingExternalUpdate = true;
  try {
    if (Reflect.ownKeys(patch).length > 0) {
      boundScene.applyPatch(patch);
    }
    savedSnapshot = sceneSnapshot(data);
  } finally {
    applyingExternalUpdate = false;
  }
  syncDirtyState();
}

function subscribeSceneHmr(): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SCENE_HMR_EVENT, onSceneHmr);
  return () => window.removeEventListener(SCENE_HMR_EVENT, onSceneHmr);
}

function syncDirtyState(): void {
  if (!boundScene) return;
  useSceneFileStore.setState({
    dirty: sceneSnapshot(boundScene.getRaw()) !== savedSnapshot,
  });
}

async function importSceneModule(relativePath: string): Promise<SceneObject | null> {
  try {
    const mod = await import(/* @vite-ignore */ `/${relativePath}`);
    return stripScenePatchSentinels((mod.default ?? {}) as SceneObject);
  } catch {
    return null;
  }
}

async function loadSceneAtPath(relativePath: string): Promise<void> {
  if (!boundScene || !relativePath) return;

  const data = await importSceneModule(relativePath);
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
  unsubscribeSceneHmr = subscribeSceneHmr();

  unsubscribeOnChange = scene.onChange(() => {
    if (applyingExternalUpdate || useSceneFileStore.getState().saving) return;
    syncDirtyState();
  });

  unsubscribeStore = useSceneFileStore.subscribe((state, previous) => {
    if (state.activeScenePath === previous.activeScenePath) return;
    if (!state.activeScenePath) return;
    void loadSceneAtPath(state.activeScenePath);
  });

  const path = initialPath || useSceneFileStore.getState().activeScenePath;
  if (path) {
    void loadSceneAtPath(path);
  } else {
    syncDirtyState();
  }

  return () => {
    unsubscribeOnChange?.();
    unsubscribeStore?.();
    unsubscribeSceneHmr?.();
    boundScene = null;
  };
}

export async function hydrateSceneFileStore(): Promise<string> {
  await useSceneFileStore.persist.rehydrate();
  return useSceneFileStore.getState().activeScenePath;
}

export function subscribeSceneFileHostState(): () => void {
  function onMessage(event: MessageEvent): void {
    if (event.source !== window.parent) return;
    const raw = event.data;
    if (!raw || typeof raw !== "object" || typeof raw.type !== "string") return;
    if (raw.type !== SCENE_CHANNEL.sceneEditorState) return;

    const content = (raw as { content?: unknown }).content;
    if (!content || typeof content !== "object") return;
    const state = content as { path?: unknown; dirty?: unknown; saving?: unknown };
    if (typeof state.dirty !== "boolean" || typeof state.saving !== "boolean") {
      return;
    }

    const updates: Partial<SceneFileStore> = {
      dirty: state.dirty,
      saving: state.saving,
    };
    if (typeof state.path === "string" && state.path) {
      updates.activeScenePath = state.path;
    }
    useSceneFileStore.setState(updates);
  }

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
