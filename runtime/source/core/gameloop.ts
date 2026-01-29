import { resetDragHandlerInitialization } from "./dragHandler";
import { isEditorMode } from "./utils";
import { runStartCallbacks, runEditorStartCallbacks, clearStartCallbacks } from "./initialization";

export type CallbackId = number;

function createCallbackManager<T extends (...args: any[]) => void>(
  requireEditorMode: boolean = false
) {
  const callbacks: T[] = [];
  const idToIndex = new Map<CallbackId, number>();
  const freeIndices: number[] = [];

  const add = (callback: T): CallbackId => {
    if (requireEditorMode && !isEditorMode()) {
      return -1;
    }
    const id = nextCallbackId++;
    let index: number;
    if (freeIndices.length > 0) {
      index = freeIndices.pop()!;
      callbacks[index] = callback;
    } else {
      index = callbacks.length;
      callbacks.push(callback);
    }
    idToIndex.set(id, index);
    return id;
  };

  const remove = (id: CallbackId): boolean => {
    const index = idToIndex.get(id);
    if (index === undefined) {
      return false;
    }
    (callbacks as (T | null)[])[index] = null;
    freeIndices.push(index);
    idToIndex.delete(id);
    return true;
  };

  const clear = (): void => {
    callbacks.length = 0;
    idToIndex.clear();
    freeIndices.length = 0;
  };

  const getArray = (): (T | null)[] => callbacks as (T | null)[];

  return { add, remove, clear, getArray };
}

let nextCallbackId = 1;

const updateCallbacks = createCallbackManager<(deltaTime: number) => void>();
const drawCallbacks = createCallbackManager<() => void>();
const editorDrawCallbacks = createCallbackManager<() => void>(true);
const editorUpdateCallbacks = createCallbackManager<() => void>(true);

export let updateEnabled = false;
export let drawEnabled = true;
export let editorUpdateEnabled = true;

export const setUpdateEnabled = (enabled: boolean) => {
  const wasEnabled = updateEnabled;
  updateEnabled = enabled;

  // Run start callbacks when transitioning from disabled to enabled
  if (!wasEnabled && enabled) {
    runStartCallbacks();
  }

  // Run editor start callbacks when transitioning from enabled to disabled
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

export const resetAllCallbacks = (): void => {
  updateCallbacks.clear();
  drawCallbacks.clear();
  editorDrawCallbacks.clear();
  editorUpdateCallbacks.clear();
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
    const arr = updateCallbacks.getArray();
    for (let i = 0; i < arr.length; i++) {
      const callback = arr[i];
      if (callback !== null) callback(deltaTime);
    }
  }

  if (drawEnabled) {
    const drawArr = drawCallbacks.getArray();
    for (let i = 0; i < drawArr.length; i++) {
      const callback = drawArr[i];
      if (callback !== null) callback();
    }
    if (editorUpdateEnabled) {
      const editorDrawArr = editorDrawCallbacks.getArray();
      for (let i = 0; i < editorDrawArr.length; i++) {
        const callback = editorDrawArr[i];
        if (callback !== null) callback();
      }
    }
  }
  if (editorUpdateEnabled) {
    const editorUpdateArr = editorUpdateCallbacks.getArray();
    for (let i = 0; i < editorUpdateArr.length; i++) {
      const callback = editorUpdateArr[i];
      if (callback !== null) callback();
    }
  }

  lastTime = currentTime;
  requestAnimationFrame(gameloop);
};

document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
});

requestAnimationFrame(gameloop);
