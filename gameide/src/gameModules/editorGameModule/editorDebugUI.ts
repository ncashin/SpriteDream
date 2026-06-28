const listeners = new Set<() => void>();

let enabled = false;

export function getEditorDebugUIEnabled(): boolean {
  return enabled;
}

export function setEditorDebugUIEnabled(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  listeners.forEach((listener) => {
    listener();
  });
}

export function toggleEditorDebugUI(): void {
  setEditorDebugUIEnabled(!enabled);
}

export function onEditorDebugUIChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
