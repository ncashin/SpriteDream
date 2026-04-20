import type { SceneObject, SceneReflectUpdate } from "./scene/scene.js";

export const SCENE_OWNER_ID = "__ownerId" as const;

export function isOwnedSceneObject(
  object: SceneObject,
  peerId: string,
): boolean {
  return object[SCENE_OWNER_ID] === peerId;
}

export function isOwnedSceneUpdate(
  update: SceneReflectUpdate,
  peerId: string,
): boolean {
  if (String(update.property) === peerId) return true;
  if (update.path.length > 0 && String(update.path[0]) === peerId) return true;
  return false;
}

export function withOwnership<T extends Record<string, unknown>>(
  object: T,
  peerId: string,
): T & Record<typeof SCENE_OWNER_ID, string> {
  return { ...object, [SCENE_OWNER_ID]: peerId };
}
