import type { SceneObjectData, SceneUpdate } from "./scene/scene.js";

export const SCENE_OWNER_ID = "__ownerId" as const;

export function isOwnedSceneObject(
  obj: SceneObjectData,
  peerId: string,
): boolean {
  return (obj as Record<string, unknown>)[SCENE_OWNER_ID] === peerId;
}

export function isOwnedSceneUpdate(
  update: SceneUpdate,
  peerId: string,
): boolean {
  if (String(update.key) === peerId) return true;
  if (update.path.length > 0 && String(update.path[0]) === peerId) return true;
  return false;
}

export function withOwnership<T extends Record<string, unknown>>(
  obj: T,
  peerId: string,
): T & Record<typeof SCENE_OWNER_ID, string> {
  return { ...obj, [SCENE_OWNER_ID]: peerId };
}
