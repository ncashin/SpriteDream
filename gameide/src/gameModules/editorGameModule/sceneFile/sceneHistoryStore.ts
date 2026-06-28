import { create } from "zustand";
import type { Scene, SceneObject } from "../../../scene/scene.js";
import {
  getSelectedObjectKey,
  restoreSelectedObjectKey,
} from "../../../scene/objectSelection.js";

const SCENE_HISTORY_DEBOUNCE_MS = 400;

function sceneSnapshot(data: SceneObject): string {
  return JSON.stringify(data);
}

type SceneHistoryStore = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

export const useSceneHistoryStore = create<SceneHistoryStore>()((set, get) => ({
  canUndo: false,
  canRedo: false,

  undo: () => {
    undoSceneChange();
  },

  redo: () => {
    redoSceneChange();
  },
}));

let boundScene: Scene | null = null;
let currentSnapshot = "";
let applyingHistoryNavigation = false;
let unsubscribeOnChange: (() => void) | undefined;
let undoStack: SceneObject[] = [];
let redoStack: SceneObject[] = [];
let pendingUndoSnapshot: SceneObject | null = null;
let pendingHistoryTimer: ReturnType<typeof setTimeout> | null = null;
let isChangeTrackingPaused: (() => boolean) | undefined;
let onSceneRestoredFromHistory: (() => void) | undefined;

function syncHistoryState(): void {
  const canUndo = undoStack.length > 0 || pendingUndoSnapshot !== null;
  const canRedo = redoStack.length > 0;
  const { canUndo: prevCanUndo, canRedo: prevCanRedo } =
    useSceneHistoryStore.getState();
  if (canUndo === prevCanUndo && canRedo === prevCanRedo) return;
  useSceneHistoryStore.setState({ canUndo, canRedo });
}

function clearPendingHistoryTimer(): void {
  if (pendingHistoryTimer === null) return;
  clearTimeout(pendingHistoryTimer);
  pendingHistoryTimer = null;
}

export function flushPendingHistory(): void {
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

export function resetSceneHistory(nextScene: SceneObject): void {
  clearPendingHistoryTimer();
  currentSnapshot = sceneSnapshot(nextScene);
  undoStack = [];
  redoStack = [];
  pendingUndoSnapshot = null;
  syncHistoryState();
}

export function syncHistoryCurrentSnapshot(nextScene: SceneObject): void {
  currentSnapshot = sceneSnapshot(nextScene);
}

export function isApplyingHistoryNavigation(): boolean {
  return applyingHistoryNavigation;
}

function applySceneSnapshotFromHistory(nextScene: SceneObject): void {
  if (!boundScene) return;
  const selectedKey = getSelectedObjectKey();
  applyingHistoryNavigation = true;
  try {
    boundScene.replace(nextScene);
    currentSnapshot = sceneSnapshot(nextScene);
    restoreSelectedObjectKey(boundScene, selectedKey);
  } finally {
    applyingHistoryNavigation = false;
  }
  onSceneRestoredFromHistory?.();
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

export function bindSceneHistoryStore(
  scene: Scene,
  options: {
    isChangeTrackingPaused: () => boolean;
    onSceneRestoredFromHistory: () => void;
  },
): () => void {
  boundScene = scene;
  isChangeTrackingPaused = options.isChangeTrackingPaused;
  onSceneRestoredFromHistory = options.onSceneRestoredFromHistory;
  resetSceneHistory(scene.getRaw());

  unsubscribeOnChange = scene.onChange(() => {
    if (isChangeTrackingPaused?.() || applyingHistoryNavigation) {
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
  });

  return () => {
    flushPendingHistory();
    unsubscribeOnChange?.();
    boundScene = null;
    isChangeTrackingPaused = undefined;
    onSceneRestoredFromHistory = undefined;
    resetSceneHistory({});
  };
}
