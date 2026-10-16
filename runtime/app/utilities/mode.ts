export enum Mode {
  Edit = "edit",
  Play = "play",
}

export let mode = Mode.Edit;
export let simulating = false;

const listeners = new Set<(mode: Mode) => void>();

export function setMode(next: Mode, nextSimulating = simulating) {
  if (mode === next && simulating === nextSimulating) return;
  mode = next;
  simulating = nextSimulating;
  for (const listener of listeners) listener(mode);
}

export function onModeChange(listener: (mode: Mode) => void, signal?: AbortSignal) {
  listeners.add(listener);
  signal?.addEventListener("abort", () => listeners.delete(listener));
}
