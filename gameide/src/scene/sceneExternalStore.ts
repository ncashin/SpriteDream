let snapshotVersion = 0;
const listeners = new Set<() => void>();

export function getUseSceneSnapshot(): number {
  return snapshotVersion;
}

export function subscribeUseSceneSnapshot(
  onStoreChange: () => void,
): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function invalidateUseSceneSnapshot(): void {
  snapshotVersion++;
  listeners.forEach((callback) => {
    try {
      callback();
    } catch (err) {
      console.error("[useScene] snapshot listener error:", err);
    }
  });
}
