import type { ScenePatch } from "./types.js";

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

/** Build a nested patch object from a path and value (or delete). Use null at leaf for delete. */
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
