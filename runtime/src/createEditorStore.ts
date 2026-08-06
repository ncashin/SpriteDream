import type { EditorStoreState, EditorStoreMessage as Message } from "./editorStoreSchema";
import { diffObject, patchObject } from "./tomove/scene";

export type Path = string;

export type SelectedObject = {
  path: Path;
};

export const Mode = {
  Editor: "editor",
  Game: "game",
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

type Listener = () => void;

export type Transport = {
  sendMessage: (message: Message) => void;
  onMessage: (messageHandler: (message: Message) => void) => () => void;
};

export type EditorStoreOptions = {
  initialState?: EditorStoreState;
  transport?: Transport;
  awaitInitialization?: boolean;
};
export const createEditorStore = async ({
  initialState,
  transport,
  awaitInitialization,
}: EditorStoreOptions) => {
  let state: EditorStoreState = {
    selectedObjects: [],
    scene: {},
    mode: Mode.Editor,
    ...initialState,
  };

  const listeners = new Set<Listener>();

  const getSnapshot = () => state;

  let previousState = structuredClone(state);
  const emit = () => {
    listeners.forEach((listener) => {
      listener();
    });

    const statePatch = diffObject(previousState, state);
    if (Object.keys(statePatch).length <= 0) return;
    transport?.sendMessage({
      type: "editorStorePatch",
      patch: statePatch,
    });
    previousState = structuredClone(state);
  };

  const subscribe = <TReturn>(selector: (state: EditorStoreState) => TReturn) => {
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

  const setState = (updateFunction: (state: EditorStoreState) => Partial<EditorStoreState>) => {
    const newState = updateFunction(state);
    const statePatch = diffObject(state, newState);

    if (Object.keys(statePatch).length <= 0) return;

    patchObject(state, statePatch);

    emit();
  };

  if (transport) {
    await new Promise<void>((resolve) => {
      if (!awaitInitialization) resolve();

      const unsubscribe = transport.onMessage((message) => {
        switch (message.type) {
          case "editorStoreState":
            state = message.state;
            unsubscribe();
            resolve();
            emit();
            break;

          case "editorStorePatch":
            patchObject(state, message.patch);
            console.log(message.patch);
            emit();
            break;

          case "editorStoreRequestState":
            transport.sendMessage({
              type: "editorStoreState",
              state,
            });
            break;
        }
      });

      transport.sendMessage({
        type: "editorStoreRequestState",
      });
    });
  }

  return { state, transport, getSnapshot, subscribe, setState, emit };
};

export type EditorStore = ReturnType<typeof createEditorStore>;
