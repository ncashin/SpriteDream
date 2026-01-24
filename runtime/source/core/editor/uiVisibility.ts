// Simple state management for UI visibility
let gameUIVisible = true;
let editorUIVisible = true;

const listeners: Set<() => void> = new Set();

export function setGameUIVisible(visible: boolean) {
  gameUIVisible = visible;
  notifyListeners();
}

export function setEditorUIVisible(visible: boolean) {
  editorUIVisible = visible;
  notifyListeners();
}

export function isGameUIVisible(): boolean {
  return gameUIVisible;
}

export function isEditorUIVisible(): boolean {
  return editorUIVisible;
}

export function subscribeToVisibilityChanges(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  listeners.forEach((callback) => callback());
}

