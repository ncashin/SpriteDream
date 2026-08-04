import type { SerializableObject } from "./tomove/scene";

export type Path = string[];

export type SelectedObject = {
  path: Path;
};

export const Mode = {
  Editor: "editor",
  Running: "running",
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

export type EditorStore = {
  selectedObjects: [];
  scene: SerializableObject;
  mode: Mode;
};

type Listener = () => void;

export const createEditorStore = (initialState?: EditorStore) => {
  let state: EditorStore = { selectedObjects: [], scene: {}, mode: Mode.Editor, ...initialState };
  const listeners = new Set<Listener>();

  const getSnapshot = () => {
    return state;
  };
  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const setState = (updateFunction: (state: EditorStore) => Partial<EditorStore>) => {
    state = {
      ...state,
      ...updateFunction(state),
    };
    listeners.forEach((listener) => {
      listener();
    });
  };

  return { getSnapshot, subscribe, setState };
};
