import type { SerializableObject } from "./tomove/scene";

export type Path = string;

export type SelectedObject = {
  path: Path;
};

export const Mode = {
  Editor: "editor",
  Game: "game",
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

export type EditorStore = {
  selectedObjects: Path[];
  scene: SerializableObject;
  mode: Mode;
};

type Listener = () => void;

export const createEditorStore = (initialState?: EditorStore) => {
  let state: EditorStore = {
    selectedObjects: [],
    scene: {},
    mode: Mode.Editor,
    ...initialState,
  };

  const listeners = new Set<Listener>();

  const getSnapshot = () => state;

  const subscribe = <TReturn>(selector: (state: EditorStore) => TReturn) => {
    return (listener: Listener) => {
      let previousValue = selector(state);

      const handleChange = () => {
        const nextValue = selector(state);

        if (!Object.is(previousValue, nextValue)) {
          previousValue = nextValue;
          listener();
        }
      };

      listeners.add(handleChange);

      return () => {
        listeners.delete(handleChange);
      };
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
