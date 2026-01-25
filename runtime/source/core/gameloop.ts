import { resetDragHandlerInitialization } from "./dragHandler";
import { isEditorMode } from "./utils";

export type CallbackId = number;

const updateCallbacks: Record<CallbackId, (deltaTime: number) => void> = {};
const drawCallbacks: Record<CallbackId, () => void> = {};
const editorDrawCallbacks: Record<CallbackId, () => void> = {};
const editorUpdateCallbacks: Record<CallbackId, () => void> = {};

let nextCallbackId = 1;

export let updateEnabled = false;
export let drawEnabled = true;
export let editorUpdateEnabled = true;

export const setUpdateEnabled = (enabled: boolean) => {
  updateEnabled = enabled;
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
): CallbackId => {
  const id = nextCallbackId++;
  updateCallbacks[id] = callback;
  return id;
};

export const removeUpdateCallback = (id: CallbackId): boolean => {
  if (id in updateCallbacks) {
    delete updateCallbacks[id];
    return true;
  }
  return false;
};

export const addDrawCallback = (callback: () => void): CallbackId => {
  const id = nextCallbackId++;
  drawCallbacks[id] = callback;
  return id;
};

export const removeDrawCallback = (id: CallbackId): boolean => {
  if (id in drawCallbacks) {
    delete drawCallbacks[id];
    return true;
  }
  return false;
};

export const addEditorDrawCallback = (callback: () => void): CallbackId => {
  if (isEditorMode()) {
    const id = nextCallbackId++;
    editorDrawCallbacks[id] = callback;
    return id;
  }
  return -1;
};

export const removeEditorDrawCallback = (id: CallbackId): boolean => {
  if (id in editorDrawCallbacks) {
    delete editorDrawCallbacks[id];
    return true;
  }
  return false;
};

export const addEditorUpdateCallback = (callback: () => void): CallbackId => {
  if (isEditorMode()) {
    const id = nextCallbackId++;
    editorUpdateCallbacks[id] = callback;
    return id;
  }
  return -1;
};

export const removeEditorCallback = (id: CallbackId): boolean => {
  if (id in editorUpdateCallbacks) {
    delete editorUpdateCallbacks[id];
    return true;
  }
  return false;
};

export const resetAllCallbacks = (): void => {
  for (const id in updateCallbacks) {
    delete updateCallbacks[id];
  }

  for (const id in drawCallbacks) {
    delete drawCallbacks[id];
  }

  for (const id in editorDrawCallbacks) {
    delete editorDrawCallbacks[id];
  }

  for (const id in editorUpdateCallbacks) {
    delete editorUpdateCallbacks[id];
  }

  nextCallbackId = 1;

  resetDragHandlerInitialization();
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
    for (const callback of Object.values(updateCallbacks)) {
      callback(deltaTime);
    }
  }

  if (drawEnabled) {
    for (const callback of Object.values(drawCallbacks)) {
      callback();
    }
    if (editorUpdateEnabled) {
      for (const callback of Object.values(editorDrawCallbacks)) {
        callback();
      }
    }
  }
  if (editorUpdateEnabled) {
    for (const callback of Object.values(editorUpdateCallbacks)) {
      callback();
    }
  }

  lastTime = currentTime;
  requestAnimationFrame(gameloop);
};

document.addEventListener("visibilitychange", () => {
  const now = performance.now();
  if (document.hidden) {
    lastTime = now;
  } else {
    lastTime = now;
  }
});

requestAnimationFrame(gameloop);
