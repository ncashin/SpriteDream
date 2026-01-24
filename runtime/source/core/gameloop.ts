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
let isPageVisible = !document.hidden;
let wasPageVisible = isPageVisible;
const MAX_DELTA_TIME = 1 / 30; // Cap at 33ms (30 FPS minimum)

const gameloop = (currentTime: number) => {
  // Handle visibility changes - reset time if page was hidden
  isPageVisible = !document.hidden;
  if (!wasPageVisible && isPageVisible) {
    // Page just became visible - reset lastTime to prevent huge deltaTime spike
    lastTime = currentTime;
  }
  wasPageVisible = isPageVisible;

  // Calculate deltaTime and cap it to prevent large spikes
  let deltaTime = (currentTime - lastTime) / 1000;

  // Cap deltaTime to prevent physics/state issues when tab was hidden
  if (deltaTime > MAX_DELTA_TIME) {
    deltaTime = MAX_DELTA_TIME;
  }

  // Skip updates if page is hidden (but still allow draws for editor)
  if (updateEnabled && isPageVisible) {
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

  lastTime = currentTime;
  requestAnimationFrame(gameloop);
};

// Handle visibility changes to prevent state corruption
document.addEventListener("visibilitychange", () => {
  const now = performance.now();
  if (document.hidden) {
    // Page is being hidden - update lastTime so we don't get a huge delta when we come back
    lastTime = now;
  } else {
    // Page is becoming visible - reset lastTime to prevent deltaTime spike
    lastTime = now;
  }
});

requestAnimationFrame(gameloop);

// HMR: Preserve running state across hot updates
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    if (data) {
      data.updateEnabled = updateEnabled;
      data.drawEnabled = drawEnabled;
      data.editorEnabled = editorEnabled;
      // Preserve lastTime to prevent large deltaTime spike after HMR
      data.lastTime = lastTime;
      data.isPageVisible = isPageVisible;
      data.wasPageVisible = wasPageVisible;
    }
  });

  const hotData = import.meta.hot.data;
  if (hotData) {
    // Restore running state if it was preserved
    if (hotData.updateEnabled !== undefined) {
      updateEnabled = hotData.updateEnabled;
    }
    if (hotData.drawEnabled !== undefined) {
      drawEnabled = hotData.drawEnabled;
    }
    if (hotData.editorEnabled !== undefined) {
      editorEnabled = hotData.editorEnabled;
    }
    // Restore visibility state
    if (hotData.isPageVisible !== undefined) {
      isPageVisible = hotData.isPageVisible;
    }
    if (hotData.wasPageVisible !== undefined) {
      wasPageVisible = hotData.wasPageVisible;
    }
    // Restore lastTime to maintain smooth timing after HMR
    // Cap deltaTime at 1/30 second (33ms) to prevent large spikes if HMR took a while
    if (hotData.lastTime !== undefined) {
      const currentTime = performance.now();
      const timeSinceLastFrame = currentTime - hotData.lastTime;
      // If HMR took too long, reset to current time to prevent huge deltaTime
      if (timeSinceLastFrame > 100) {
        lastTime = currentTime;
      } else {
        lastTime = hotData.lastTime;
      }
    }
  }
}
