export type ScenePatch = Record<PropertyKey, unknown>;

function isPlainObjectForPatch(
  value: unknown
): value is Record<PropertyKey, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function applyScenePatch(
  scene: Record<PropertyKey, unknown>,
  patch: ScenePatch
): void {
  for (const key of Object.keys(patch)) {
    const patchValue = patch[key];

    if (patchValue === null) {
      Reflect.deleteProperty(scene, key);
    } else if (isPlainObjectForPatch(patchValue)) {
      const existing = Reflect.get(scene, key);
      if (
        existing !== undefined &&
        (isPlainObjectForPatch(existing) || Array.isArray(existing))
      ) {
        applyScenePatch(existing as Record<PropertyKey, unknown>, patchValue);
      } else {
        Reflect.set(scene, key, {});
        const created = Reflect.get(scene, key) as Record<PropertyKey, unknown>;
        applyScenePatch(created, patchValue);
      }
    } else {
      Reflect.set(scene, key, patchValue);
    }
  }
}

export function applyScenePatchesInOrder(
  scene: Record<PropertyKey, unknown>,
  patches: ScenePatch[]
): void {
  for (const patch of patches) {
    applyScenePatch(scene, patch);
  }
}

export function patchAtPath(
  pathSegments: PropertyKey[],
  value?: unknown,
  deleteKey?: boolean
): ScenePatch {
  if (pathSegments.length === 0) return {};
  let current: ScenePatch = {};
  const root = current;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    const next: ScenePatch = {};
    current[segment] = next;
    current = next;
  }
  current[pathSegments[pathSegments.length - 1]] = deleteKey ? null : value;
  return root;
}

export function buildScenePatchFromDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  pathPrefix: PropertyKey[] = [],
  mergedPatch: ScenePatch = {}
): ScenePatch {
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const isPlainObject = (v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  for (const key of allKeys) {
    const pathWithKey = pathPrefix.concat(key);
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    if (!(key in newObj)) {
      applyScenePatch(mergedPatch, patchAtPath(pathWithKey, undefined, true));
      continue;
    }
    if (isPlainObject(newVal)) {
      const oldForMerge: Record<string, unknown> = isPlainObject(oldVal)
        ? (oldVal as Record<string, unknown>)
        : Array.isArray(oldVal)
          ? (oldVal as unknown as Record<string, unknown>)
          : {};
      buildScenePatchFromDiff(
        oldForMerge,
        newVal as Record<string, unknown>,
        pathWithKey,
        mergedPatch
      );
      continue;
    }
    if (oldVal !== newVal) {
      applyScenePatch(mergedPatch, patchAtPath(pathWithKey, newVal));
    }
  }
  return mergedPatch;
}
