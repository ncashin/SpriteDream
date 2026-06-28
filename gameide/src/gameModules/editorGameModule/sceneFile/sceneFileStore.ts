import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GameIDEMode, getMode, setMode } from "../../../lifecycle/mode.js";
import { SCENE_CHANNEL } from "../../../scene/sceneChannel/sceneChannel.js";
import type { Scene, SceneObject } from "../../../scene/scene.js";
import { diffScenePatch } from "../../../scene/scene.js";
import { pickUntitledSceneSavePath } from "./pickSceneSavePath.js";
import {
  bindSceneHistoryStore,
  flushPendingHistory,
  isApplyingHistoryNavigation,
  resetSceneHistory,
  syncHistoryCurrentSnapshot,
} from "./sceneHistoryStore.js";
import {
  getVirtualCatalogs,
  loadVirtualCatalogs,
  subscribeVirtualCatalogs,
} from "../../../virtualCatalogStore.js";
import { SCENE_HMR_EVENT } from "../../../scene/sceneHMREvent.js";

const STORAGE_KEY = "gameide-scene-file";
const SCENE_FILE_API = "/gameide/scene";
let catalogListenerRegistered = false;

function ensureCatalogListener(): void {
  if (catalogListenerRegistered) return;
  catalogListenerRegistered = true;
  subscribeVirtualCatalogs(() => {
    useSceneFileStore.getState().setScenes([...getVirtualCatalogs().scenes]);
  });
}

function sceneSnapshot(data: SceneObject): string {
  return JSON.stringify(data);
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
  isUntitled: boolean;
  scenes: string[];
  dirty: boolean;
  saving: boolean;
  setScenes: (scenes: string[]) => void;
  setActiveScenePath: (path: string) => void;
  loadScenes: () => Promise<void>;
  requestSave: () => void;
  createScene: () => void;
};

export const useSceneFileStore = create<SceneFileStore>()(
  persist(
    (set, get) => ({
      activeScenePath: "",
      isUntitled: false,
      scenes: [],
      dirty: false,
      saving: false,

      setScenes: (scenes) => {
        const { isUntitled, activeScenePath } = get();
        if (isUntitled) {
          set({ scenes });
          return;
        }
        set({
          scenes,
          activeScenePath: pickActiveScene(scenes, activeScenePath),
        });
      },

      setActiveScenePath: (path) => {
        if (!path) return;
        if (path === get().activeScenePath && !get().isUntitled) return;
        set({ activeScenePath: path, isUntitled: false });
      },

      loadScenes: async () => {
        await loadVirtualCatalogs();
        ensureCatalogListener();
        get().setScenes([...getVirtualCatalogs().scenes]);
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

      createScene: () => {
        const { dirty } = get();
        if (dirty) {
          const discard = window.confirm(
            "Discard unsaved changes and create a new scene?",
          );
          if (!discard) return;
        }

        if (getMode() === GameIDEMode.Game) {
          setMode(GameIDEMode.Editor);
        }

        const wasUntitled = get().isUntitled;
        set({ isUntitled: true });
        if (wasUntitled) {
          void openUntitledScene();
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) =>
        state.isUntitled ? {} : { activeScenePath: state.activeScenePath },
    },
  ),
);

let boundScene: Scene | null = null;
let savedSnapshot = "";
let applyingExternalUpdate = false;
let skipNextSceneLoad = false;
let unsubscribeOnChange: (() => void) | undefined;
let unsubscribeStore: (() => void) | undefined;
let unsubscribeSceneHMR: (() => void) | undefined;
let releaseSceneHistoryStore: (() => void) | undefined;

function onSceneHMR(event: Event): void {
  if (!boundScene) return;
  const detail = (event as CustomEvent<{ path?: unknown; data?: unknown }>).detail;
  if (!detail || typeof detail.path !== "string" || !detail.data || typeof detail.data !== "object") {
    return;
  }
  const { activeScenePath } = useSceneFileStore.getState();
  if (detail.path !== activeScenePath) return;

  const data = detail.data as SceneObject;
  const patch = diffScenePatch(boundScene.getRaw(), data);

  applyingExternalUpdate = true;
  try {
    if (Reflect.ownKeys(patch).length > 0) {
      boundScene.applyPatch(patch);
    }
    savedSnapshot = sceneSnapshot(data);
    resetSceneHistory(data);
  } finally {
    applyingExternalUpdate = false;
  }
  syncDirtyState();
}

type SceneHMRDetail = { path: string; data: SceneObject };

function subscribeSceneHMR(): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SCENE_HMR_EVENT, onSceneHMR);

  const hot = import.meta.hot;
  const onHotSceneUpdate = (detail: SceneHMRDetail) => {
    window.dispatchEvent(
      new CustomEvent(SCENE_HMR_EVENT, { detail }),
    );
  };
  hot?.on(SCENE_HMR_EVENT, onHotSceneUpdate);

  return () => {
    window.removeEventListener(SCENE_HMR_EVENT, onSceneHMR);
    hot?.off(SCENE_HMR_EVENT, onHotSceneUpdate);
  };
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
    return (mod.default ?? {}) as SceneObject;
  } catch {
    return null;
  }
}

async function loadSceneAtPath(relativePath: string): Promise<void> {
  if (!boundScene || !relativePath) return;

  const data = await importSceneModule(relativePath);
  if (!data) {
    await useSceneFileStore.getState().loadScenes();
    return;
  }

  applyingExternalUpdate = true;
  try {
    boundScene.replace(data);
    savedSnapshot = sceneSnapshot(data);
    resetSceneHistory(data);
  } finally {
    applyingExternalUpdate = false;
  }
  syncDirtyState();
}

async function openUntitledScene(): Promise<void> {
  if (!boundScene) return;

  applyingExternalUpdate = true;
  try {
    boundScene.replace({});
    savedSnapshot = sceneSnapshot({});
    resetSceneHistory({});
  } finally {
    applyingExternalUpdate = false;
  }
  syncDirtyState();
}

async function saveActiveScene(): Promise<void> {
  flushPendingHistory();
  const state = useSceneFileStore.getState();
  const { activeScenePath, isUntitled, saving, dirty, scenes } = state;
  if (!boundScene || saving || !dirty) return;

  let targetPath = activeScenePath;
  if (isUntitled) {
    targetPath = pickUntitledSceneSavePath(scenes) ?? "";
    if (!targetPath) return;
  }

  if (!targetPath) return;

  useSceneFileStore.setState({ saving: true });
  try {
    const res = await fetch(SCENE_FILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: targetPath,
        content: boundScene.getRaw(),
      }),
    });
    if (!res.ok) throw new Error("Failed to save scene");
    const savedScene = boundScene.getRaw();
    savedSnapshot = sceneSnapshot(savedScene);
    syncHistoryCurrentSnapshot(savedScene);
    skipNextSceneLoad = true;
    useSceneFileStore.setState({
      activeScenePath: targetPath,
      isUntitled: false,
      dirty: false,
    });
    await useSceneFileStore.getState().loadScenes();
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
  unsubscribeSceneHMR = subscribeSceneHMR();

  releaseSceneHistoryStore = bindSceneHistoryStore(scene, {
    isChangeTrackingPaused: () =>
      applyingExternalUpdate || useSceneFileStore.getState().saving,
    onSceneRestoredFromHistory: syncDirtyState,
  });

  unsubscribeOnChange = scene.onChange(() => {
    if (
      applyingExternalUpdate ||
      isApplyingHistoryNavigation() ||
      useSceneFileStore.getState().saving
    ) {
      return;
    }
    syncDirtyState();
  });

  unsubscribeStore = useSceneFileStore.subscribe((state, previous) => {
    const untitledChanged = state.isUntitled !== previous.isUntitled;
    const pathChanged = state.activeScenePath !== previous.activeScenePath;
    if (!untitledChanged && !pathChanged) return;

    if (skipNextSceneLoad) {
      skipNextSceneLoad = false;
      return;
    }

    if (state.isUntitled) {
      void openUntitledScene();
      return;
    }
    if (!state.activeScenePath) return;
    void loadSceneAtPath(state.activeScenePath);
  });

  const { activeScenePath, isUntitled } = useSceneFileStore.getState();
  const path = initialPath || activeScenePath;
  if (isUntitled) {
    void openUntitledScene();
  } else if (path) {
    void loadSceneAtPath(path);
  } else {
    syncDirtyState();
  }

  return () => {
    releaseSceneHistoryStore?.();
    unsubscribeOnChange?.();
    unsubscribeStore?.();
    unsubscribeSceneHMR?.();
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
      updates.isUntitled = false;
    }
    useSceneFileStore.setState(updates);
  }

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
