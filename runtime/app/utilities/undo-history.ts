import { hotkeys } from "./hotkey.ts";
import { Mode, mode } from "./mode.ts";

export function createUndoHistory<Undo, Redo = Undo>(options: {
  signal?: AbortSignal;
  onUndo?: (change: Undo) => void;
  onRedo?: (change: Redo) => void;
}) {
  const changeHistory: { undo: Undo; redo: Redo }[] = [];
  let index = 0;

  const history = {
    pushChange(change: { undo: Undo; redo: Redo }) {
      changeHistory.splice(index);
      changeHistory.push(change);
      index = changeHistory.length;
    },
  };

  if (typeof window === "undefined") return history;

  const apply = <Change>(
    handler: ((change: Change) => void) | undefined,
    change: Change | undefined,
    event: KeyboardEvent,
  ) => {
    if (change === undefined || !handler) return;
    event.preventDefault();
    event.stopPropagation();
    handler(change);
  };

  hotkeys(
    {
      "mod+z": (event) => {
        if (index === 0) return;
        index -= 1;
        apply(options.onUndo, changeHistory[index]?.undo, event);
      },
      "mod+shift+z, mod+y": (event) => {
        const change = changeHistory[index];
        if (!change) return;
        index += 1;
        apply(options.onRedo, change.redo, event);
      },
    },
    { signal: options.signal, when: () => mode === Mode.Edit },
  );

  return history;
}
