import type { GameObject, ScenePath } from "../../scene/scene.js";

type SceneReflectUpdate = { property: PropertyKey; path: ScenePath };

export const OWNER_ID = "__ownerId" as const;

export function isOwnedSceneObject(
  object: GameObject,
  peerId: string,
): boolean {
  return object[OWNER_ID] === peerId;
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
): T & Record<typeof OWNER_ID, string> {
  return { ...object, [OWNER_ID]: peerId };
}

export function peerIntegratesPhysicsForObject(
  object: GameObject,
  localPeerId: string,
): boolean {
  const owner = object[OWNER_ID];
  if (typeof owner !== "string") return true;
  return owner === localPeerId;
}
