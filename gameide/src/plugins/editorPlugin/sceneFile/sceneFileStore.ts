import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GameIDEMode, getMode } from "../../../lifecycle/mode.js";
import { SCENE_CHANNEL } from "../../../scene/sceneChannel/sceneChannel.js";
import type { Scene, SceneObject } from "../../../scene/scene.js";
import { diffScenePatch } from "../../../scene/scene.js";
import {
  getSelectedObjectKey,
  restoreSelectedObjectKey,
} from "../../../scene/objectSelection.js";

const STORAGE_KEY = "gameide-scene-file";
const SCENE_FILE_API = "/gameide/scene";
const SCENE_HMR_EVENT = "gameide:scene-hmr";
const SCENE_HISTORY_DEBOUNCE_MS = 400;

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
  scenes: string[];
  dirty: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setScenes: (scenes: string[]) => void;
  setActiveScenePath: (path: string) => void;
  loadScenes: () => Promise<void>;
  requestSave: () => void;
  undo: () => void;
  redo: () => void;
};

export const useSceneFileStore = create<SceneFileStore>()(
  persist(
    (set, get) => ({
      activeScenePath: "",
      scenes: [],
      dirty: false,
      saving: false,
      canUndo: false,
      canRedo: false,

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

      undo: () => {
        undoSceneChange();
      },

      redo: () => {
        redoSceneChange();
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
let currentSnapshot = "";
let applyingExternalUpdate = false;
let applyingHistoryNavigation = false;
let unsubscribeOnChange: (() => void) | undefined;
let unsubscribeStore: (() => void) | undefined;
let unsubscribeSceneHmr: (() => void) | undefined;
let undoStack: SceneObject[] = [];
let redoStack: SceneObject[] = [];
let pendingUndoSnapshot: SceneObject | null = null;
let pendingHistoryTimer: ReturnType<typeof setTimeout> | null = null;

function syncHistoryState(): void {
  const canUndo = undoStack.length > 0 || pendingUndoSnapshot !== null;
  const canRedo = redoStack.length > 0;
  const { canUndo: prevCanUndo, canRedo: prevCanRedo } =
    useSceneFileStore.getState();
  if (canUndo === prevCanUndo && canRedo === prevCanRedo) return;
  useSceneFileStore.setState({ canUndo, canRedo });
}

function clearPendingHistoryTimer(): void {
  if (pendingHistoryTimer === null) return;
  clearTimeout(pendingHistoryTimer);
  pendingHistoryTimer = null;
}

function flushPendingHistory(): void {
  clearPendingHistoryTimer();
  if (!pendingUndoSnapshot) return;
  if (sceneSnapshot(pendingUndoSnapshot) !== currentSnapshot) {
    undoStack.push(pendingUndoSnapshot);
  }
  pendingUndoSnapshot = null;
  syncHistoryState();
}

function schedulePendingHistoryCommit(): void {
  clearPendingHistoryTimer();
  pendingHistoryTimer = setTimeout(() => {
    flushPendingHistory();
  }, SCENE_HISTORY_DEBOUNCE_MS);
}

function resetSceneHistory(nextScene: SceneObject): void {
  clearPendingHistoryTimer();
  currentSnapshot = sceneSnapshot(nextScene);
  undoStack = [];
  redoStack = [];
  pendingUndoSnapshot = null;
  syncHistoryState();
}

function applySceneSnapshotFromHistory(nextScene: SceneObject): void {
  if (!boundScene) return;
  const selectedKey = getSelectedObjectKey();
  applyingHistoryNavigation = true;
  try {
    boundScene.replace(nextScene);
    currentSnapshot = sceneSnapshot(nextScene);
    restoreSelectedObjectKey(selectedKey);
  } finally {
    applyingHistoryNavigation = false;
  }
  syncDirtyState();
}

function undoSceneChange(): void {
  flushPendingHistory();
  if (!boundScene || undoStack.length === 0) return;
  redoStack.push(structuredClone(boundScene.getRaw()));
  const previousScene = undoStack.pop();
  if (!previousScene) return;
  applySceneSnapshotFromHistory(previousScene);
  syncHistoryState();
}

function redoSceneChange(): void {
  flushPendingHistory();
  if (!boundScene || redoStack.length === 0) return;
  undoStack.push(structuredClone(boundScene.getRaw()));
  const nextScene = redoStack.pop();
  if (!nextScene) return;
  applySceneSnapshotFromHistory(nextScene);
  syncHistoryState();
}

function onSceneHmr(event: Event): void {
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
    return (mod.default ?? {}) as SceneObject;
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
    resetSceneHistory(data);
  } finally {
    applyingExternalUpdate = false;
  }
  syncDirtyState();
}

async function saveActiveScene(): Promise<void> {
  flushPendingHistory();
  const { activeScenePath, saving, dirty } = useSceneFileStore.getState();
  if (!boundScene || !activeScenePath || saving || !dirty) return;

  useSceneFileStore.setState({ saving: true });
  try {
    const res = await fetch(SCENE_FILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: activeScenePath,
        content: boundScene.getRaw(),
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
  resetSceneHistory(scene.getRaw());
  unsubscribeSceneHmr = subscribeSceneHmr();

  unsubscribeOnChange = scene.onChange(() => {
    if (
      applyingExternalUpdate ||
      applyingHistoryNavigation ||
      useSceneFileStore.getState().saving
    ) {
      return;
    }
    const nextSnapshot = sceneSnapshot(scene.getRaw());
    if (nextSnapshot !== currentSnapshot) {
      if (!pendingUndoSnapshot) {
        pendingUndoSnapshot = JSON.parse(currentSnapshot) as SceneObject;
      }
      redoStack = [];
      currentSnapshot = nextSnapshot;
      syncHistoryState();
      schedulePendingHistoryCommit();
    }
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
    flushPendingHistory();
    unsubscribeOnChange?.();
    unsubscribeStore?.();
    unsubscribeSceneHmr?.();
    boundScene = null;
    resetSceneHistory({});
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
