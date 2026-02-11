import { resetDragHandlerInitialization } from "./dragHandler";
import { isEditorMode } from "./utils";
import { runStartCallbacks, runEditorStartCallbacks, clearStartCallbacks } from "./initialization";

export type CallbackId = number;

function createCallbackManager<T extends (...args: any[]) => void>(
  requireEditorMode: boolean = false
) {
  let callbacks: Record<CallbackId, T> = {};

  const add = (callback: T): CallbackId => {
    if (requireEditorMode && !isEditorMode()) {
      return -1;
    }
    const id = nextCallbackId++;
    callbacks[id] = callback;
    return id;
  };

  const remove = (id: CallbackId): boolean => {
    if (!(id in callbacks)) return false;
    delete callbacks[id];
    return true;
  };

  const clear = (): void => {
    callbacks = {};
  };

  const getArray = (): T[] => Object.values(callbacks);

  return { add, remove, clear, getArray };
}

let nextCallbackId = 1;

const updateCallbacks = createCallbackManager<(deltaTime: number) => void>();
const drawCallbacks = createCallbackManager<() => void>();
const editorDrawCallbacks = createCallbackManager<() => void>(true);
const editorUpdateCallbacks = createCallbackManager<() => void>(true);
const immediateEditorSyncCallbacks = createCallbackManager<() => void>(false);

export let updateEnabled = false;
export let drawEnabled = true;
export let editorUpdateEnabled = true;

export const setUpdateEnabled = (enabled: boolean) => {
  const wasEnabled = updateEnabled;
  updateEnabled = enabled;

  if (!wasEnabled && enabled) {
    runStartCallbacks();
  }

  if (wasEnabled && !enabled) {
    runEditorStartCallbacks();
  }
};
export const setDrawEnabled = (enabled: boolean) => {
  drawEnabled = enabled;
};
export const setEditorUpdateEnabled = (enabled: boolean) => {
  editorUpdateEnabled = enabled;
};

export const isUpdateEnabled = () => updateEnabled;
export const isDrawEnabled = () => drawEnabled;
export const isEditorUpdateEnabled = () => editorUpdateEnabled;

export const addUpdateCallback = (
  callback: (deltaTime: number) => void
): CallbackId => updateCallbacks.add(callback);

export const removeUpdateCallback = (id: CallbackId): boolean =>
  updateCallbacks.remove(id);

export const addDrawCallback = (callback: () => void): CallbackId =>
  drawCallbacks.add(callback);

export const removeDrawCallback = (id: CallbackId): boolean =>
  drawCallbacks.remove(id);

export const addEditorDrawCallback = (callback: () => void): CallbackId =>
  editorDrawCallbacks.add(callback);

export const removeEditorDrawCallback = (id: CallbackId): boolean =>
  editorDrawCallbacks.remove(id);

export const addEditorUpdateCallback = (callback: () => void): CallbackId =>
  editorUpdateCallbacks.add(callback);

export const removeEditorCallback = (id: CallbackId): boolean =>
  editorUpdateCallbacks.remove(id);

/**
 * Run editor update callbacks immediately. Use when ECS mutations (e.g. add/remove
 * component) should trigger UI refresh without waiting for the next frame.
 */
export const runEditorUpdateCallbacks = (): void => {
  if (editorUpdateEnabled) {
    for (const callback of editorUpdateCallbacks.getArray()) {
      callback();
    }
  }
};

export const addImmediateEditorSyncCallback = (callback: () => void): CallbackId =>
  immediateEditorSyncCallbacks.add(callback);

export const removeImmediateEditorSyncCallback = (id: CallbackId): boolean =>
  immediateEditorSyncCallbacks.remove(id);

/**
 * Run immediate sync callbacks synchronously. Use after ECS mutations to refresh
 * UI without waiting for next frame. Wrap in React flushSync for immediate paint.
 */
export const runImmediateEditorSync = (): void => {
  for (const callback of immediateEditorSyncCallbacks.getArray()) {
    callback();
  }
};

export const resetAllCallbacks = (): void => {
  updateCallbacks.clear();
  drawCallbacks.clear();
  editorDrawCallbacks.clear();
  editorUpdateCallbacks.clear();
  immediateEditorSyncCallbacks.clear();
  nextCallbackId = 1;
  resetDragHandlerInitialization();
  clearStartCallbacks();
};

let lastTime = performance.now();
let isPageVisible = !document.hidden;
let wasPageVisible = isPageVisible;
const MAX_DELTA_TIME = 1 / 30;

const gameloop = (currentTime: number) => {
  isPageVisible = !document.hidden;
  if (!wasPageVisible && isPageVisible) {
    lastTime = currentTime;
  }
  wasPageVisible = isPageVisible;

  let deltaTime = (currentTime - lastTime) / 1000;

  if (deltaTime > MAX_DELTA_TIME) {
    deltaTime = MAX_DELTA_TIME;
  }

  if (updateEnabled && isPageVisible) {
    for (const callback of updateCallbacks.getArray()) {
      callback(deltaTime);
    }
  }

  if (drawEnabled) {
    for (const callback of drawCallbacks.getArray()) {
      callback();
    }
    if (editorUpdateEnabled) {
      for (const callback of editorDrawCallbacks.getArray()) {
        callback();
      }
    }
  }
  if (editorUpdateEnabled) {
    for (const callback of editorUpdateCallbacks.getArray()) {
      callback();
    }
  }

  lastTime = currentTime;
  requestAnimationFrame(gameloop);
};

document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
});

requestAnimationFrame(gameloop);
