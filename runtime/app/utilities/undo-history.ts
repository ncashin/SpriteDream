import { hotkeys } from "./hotkey.ts";
import { Mode, mode } from "./mode.ts";

export function undoHistory<Undo, Redo = Undo>(options: {
  signal?: AbortSignal;
  /** Fold a later change into the open one. Groups stay open until changes pause. */
  join?: (
    current: { undo: Undo; redo: Redo },
    next: { undo: Undo; redo: Redo },
  ) => { undo: Undo; redo: Redo };
  onUndo?: (change: Undo) => void;
  onRedo?: (change: Redo) => void;
}) {
  const changeHistory: { undo: Undo; redo: Redo }[] = [];
  let index = 0;
  let grouping = false;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const stopGrouping = () => {
    grouping = false;
    clearTimeout(settle);
    settle = undefined;
  };

  const history = {
    pushChange(change: { undo: Undo; redo: Redo }) {
      const open = grouping && options.join && index > 0 ? changeHistory[index - 1] : undefined;
      if (open && options.join) {
        changeHistory[index - 1] = options.join(open, change);
      } else {
        changeHistory.splice(index);
        changeHistory.push(change);
        index = changeHistory.length;
      }
      if (!options.join) return;
      grouping = true;
      clearTimeout(settle);
      settle = setTimeout(stopGrouping, 300);
    },
  };

  options.signal?.addEventListener("abort", stopGrouping);

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
        stopGrouping();
        index -= 1;
        apply(options.onUndo, changeHistory[index]?.undo, event);
      },
      "mod+shift+z, mod+y": (event) => {
        const change = changeHistory[index];
        if (!change) return;
        stopGrouping();
        index += 1;
        apply(options.onRedo, change.redo, event);
      },
    },
    { signal: options.signal, when: () => mode === Mode.Edit },
  );

  return history;
}
