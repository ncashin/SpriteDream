import { resetDragHandlerInitialization } from "./dragHandler";
import { isEditorMode } from "./utils";

export type CallbackId = number;

const updateCallbacks: Record<CallbackId, (deltaTime: number) => void> = {};
const drawCallbacks: Record<CallbackId, () => void> = {};
const editorDrawCallbacks: Record<CallbackId, () => void> = {};
const editorCallbacks: Record<CallbackId, () => void> = {};

let nextCallbackId = 1;

export let updateEnabled = false;
export let drawEnabled = true;
export let editorEnabled = true;

export const setUpdateEnabled = (enabled: boolean) => {
  updateEnabled = enabled;
};
export const setDrawEnabled = (enabled: boolean) => {
  drawEnabled = enabled;
};
export const setEditorEnabled = (enabled: boolean) => {
  editorEnabled = enabled;
};

export const isUpdateEnabled = () => updateEnabled;
export const isDrawEnabled = () => drawEnabled;
export const isEditorUpdateEnabled = () => editorEnabled;

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
    editorCallbacks[id] = callback;
    return id;
  }
  return -1;
};

export const removeEditorCallback = (id: CallbackId): boolean => {
  if (id in editorCallbacks) {
    delete editorCallbacks[id];
    return true;
  }
  return false;
};

export const resetAllCallbacks = (): void => {
  // Clear all update callbacks
  for (const id in updateCallbacks) {
    delete updateCallbacks[id];
  }

  // Clear all draw callbacks
  for (const id in drawCallbacks) {
    delete drawCallbacks[id];
  }

  // Clear all editor draw callbacks
  for (const id in editorDrawCallbacks) {
    delete editorDrawCallbacks[id];
  }

  // Clear all editor callbacks
  for (const id in editorCallbacks) {
    delete editorCallbacks[id];
  }

  // Reset callback ID counter
  nextCallbackId = 1;

  // Reset drag handler initialization so it can re-register callbacks
  resetDragHandlerInitialization();
};

let lastTime = performance.now();
const gameloop = (currentTime: number) => {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (updateEnabled) {
    for (const callback of Object.values(updateCallbacks)) {
      callback(deltaTime);
    }
  }
  if (drawEnabled) {
    for (const callback of Object.values(drawCallbacks)) {
      callback();
    }
    // Editor draw callbacks run during the draw phase
    if (editorEnabled) {
      for (const callback of Object.values(editorDrawCallbacks)) {
        callback();
      }
    }
  }
  if (editorEnabled) {
    for (const callback of Object.values(editorCallbacks)) {
      callback();
    }
  }
  requestAnimationFrame(gameloop);
};

requestAnimationFrame(gameloop);
