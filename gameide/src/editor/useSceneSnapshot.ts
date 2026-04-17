/**
 * External-store snapshot for useScene (no React here — safe for scene/sceneChannel imports).
 * getScene() is referentially stable; this version bumps when scene content changes.
 */

let snapshotVersion = 0;
const listeners = new Set<() => void>();

export function getUseSceneSnapshot(): number {
  return snapshotVersion;
}

export function subscribeUseSceneSnapshot(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function invalidateUseSceneSnapshot(): void {
  snapshotVersion++;
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.error("[useScene] snapshot listener error:", err);
    }
  });
}
