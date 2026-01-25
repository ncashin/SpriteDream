import { isEditorUpdateEnabled, isUpdateEnabled } from './gameloop';
import { isEditorMode } from './utils';

const startCallbacks: (() => void)[] = [];
const editorStartCallbacks: (() => void)[] = [];

export function addStartCallback(callback: () => void): void {
  if (isUpdateEnabled()) {
    // If update is already enabled, run immediately
    callback();
  } else {
    // Otherwise, store it to run when the game starts
    startCallbacks.push(callback);
  }
}

export function addEditorStartCallback(callback: () => void): void {
  if (!isUpdateEnabled()) {
    // If update is not enabled (editor mode), run immediately
    callback();
  } else {
    // Otherwise, store it to run when entering editor mode
    editorStartCallbacks.push(callback);
  }
}

export function runStartCallbacks(): void {
  for (const callback of startCallbacks) {
    callback();
  }
  startCallbacks.length = 0;
}

export function runEditorStartCallbacks(): void {
  for (const callback of editorStartCallbacks) {
    callback();
  }
  editorStartCallbacks.length = 0;
}

export function clearStartCallbacks(): void {
  startCallbacks.length = 0;
  editorStartCallbacks.length = 0;
}
