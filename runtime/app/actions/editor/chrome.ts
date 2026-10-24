let hidden = false;

const listeners = new Set<() => void>();

export function isEditorHidden() {
  return hidden;
}

export function setEditorHidden(next: boolean) {
  if (hidden === next) return;
  hidden = next;
  for (const listener of listeners) listener();
}

export function onEditorHidden(listener: () => void, signal?: AbortSignal) {
  listeners.add(listener);
  signal?.addEventListener("abort", () => listeners.delete(listener));
}
