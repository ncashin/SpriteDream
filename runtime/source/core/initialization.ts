import { isUpdateEnabled } from './gameloop';

const startCallbacks: (() => void)[] = [];
const editorStartCallbacks: (() => void)[] = [];
let wasUpdateEnabled = false;

export function addStartCallback(callback: () => void): void {
  // If game is already running, don't add the callback
  if (isUpdateEnabled()) return;
  // Store the callback to run when game starts
  startCallbacks.push(callback);
}

export function addEditorStartCallback(callback: () => void): void {
  // If game is not running, don't add the callback
  if (!isUpdateEnabled()) return;
  // Store the callback to run when editor starts
  editorStartCallbacks.push(callback);
}

// This should be called when updateEnabled changes
export function checkAndRunStartCallbacks(currentUpdateEnabled: boolean): void {
  // Run start callbacks when transitioning from stopped to running
  if (!wasUpdateEnabled && currentUpdateEnabled) {
    for (const callback of startCallbacks) {
      callback();
    }
    // Clear callbacks after running so they can be registered again
    startCallbacks.length = 0;
  }

  // Run editor start callbacks when transitioning from running to stopped
  if (wasUpdateEnabled && !currentUpdateEnabled) {
    for (const callback of editorStartCallbacks) {
      callback();
    }
    // Clear callbacks after running so they can be registered again
    editorStartCallbacks.length = 0;
  }

  wasUpdateEnabled = currentUpdateEnabled;
}
