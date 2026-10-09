export enum Mode {
  Edit = "edit",
  Play = "play",
}

export let mode = Mode.Edit;

const listeners = new Set<(mode: Mode) => void>();

export function setMode(next: Mode) {
  if (mode === next) return;
  mode = next;
  for (const listener of listeners) listener(mode);
}

export function onModeChange(listener: (mode: Mode) => void, signal?: AbortSignal) {
  listeners.add(listener);
  signal?.addEventListener("abort", () => listeners.delete(listener));
}
