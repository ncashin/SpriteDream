import { create } from "zustand";

interface UIVisibilityState {
  gameUIVisible: boolean;
  editorUIVisible: boolean;
  setGameUIVisible: (visible: boolean) => void;
  setEditorUIVisible: (visible: boolean) => void;
}

export const useUIVisibilityStore = create<UIVisibilityState>((set) => ({
  gameUIVisible: true,
  editorUIVisible: true,
  setGameUIVisible: (visible: boolean) => set({ gameUIVisible: visible }),
  setEditorUIVisible: (visible: boolean) => set({ editorUIVisible: visible }),
}));

// Legacy API for backward compatibility
export function setGameUIVisible(visible: boolean) {
  useUIVisibilityStore.getState().setGameUIVisible(visible);
}

export function setEditorUIVisible(visible: boolean) {
  useUIVisibilityStore.getState().setEditorUIVisible(visible);
}

export function isGameUIVisible(): boolean {
  return useUIVisibilityStore.getState().gameUIVisible;
}

export function isEditorUIVisible(): boolean {
  return useUIVisibilityStore.getState().editorUIVisible;
}

// Legacy subscription API for backward compatibility
const listeners: Set<() => void> = new Set();

export function subscribeToVisibilityChanges(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Subscribe to Zustand store changes to notify legacy listeners
useUIVisibilityStore.subscribe((state) => {
  listeners.forEach((callback) => callback());
});

