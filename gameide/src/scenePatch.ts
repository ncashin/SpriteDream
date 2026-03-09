export type ScenePatch = Record<PropertyKey, unknown>;

function isMergeable(
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
      delete scene[key];
    } else if (isMergeable(patchValue)) {
      const existing = scene[key];
      if (existing !== undefined && isMergeable(existing)) {
        applyScenePatch(existing, patchValue);
      } else {
        const created: Record<PropertyKey, unknown> = {};
        scene[key] = created;
        applyScenePatch(created, patchValue);
      }
    } else {
      scene[key] = patchValue;
    }
  }
}

export function pathToPatch(
  path: PropertyKey[],
  value?: unknown,
  isDelete?: boolean
): ScenePatch {
  if (path.length === 0) return {};
  let current: ScenePatch = {};
  const root = current;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next: ScenePatch = {};
    current[key] = next;
    current = next;
  }
  current[path[path.length - 1]] = isDelete ? null : value;
  return root;
}

/**
 * Build a scene patch that transforms oldObj into newObj (diff from old to new).
 * Useful for comparing document state vs file/saved state.
 */
export function buildPatchFromDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  path: string[] = [],
  acc: ScenePatch = {}
): ScenePatch {
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const isObj = (v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  for (const key of allKeys) {
    const p = path.concat(key);
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    if (!(key in newObj)) {
      applyScenePatch(acc, pathToPatch(p, undefined, true));
      continue;
    }
    if (isObj(newVal)) {
      buildPatchFromDiff(
        (isObj(oldVal) ? oldVal : {}) as Record<string, unknown>,
        newVal as Record<string, unknown>,
        p,
        acc
      );
      continue;
    }
    if (oldVal !== newVal) {
      applyScenePatch(acc, pathToPatch(p, newVal));
    }
  }
  return acc;
}
