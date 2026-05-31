let snapshotVersion = 0;
const listeners = new Set<() => void>();

export function getExternalSceneSnapshot(): number {
  return snapshotVersion;
}

export function subscribeExternalSceneSnapshot(
  onStoreChange: () => void,
): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function invalidateExternalSceneSnapshot(): void {
  snapshotVersion++;
  listeners.forEach((callback) => {
    try {
      callback();
    } catch (err) {
      console.error("[externalSceneSnapshot] listener error:", err);
    }
  });
}
