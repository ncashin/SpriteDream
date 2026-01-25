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

