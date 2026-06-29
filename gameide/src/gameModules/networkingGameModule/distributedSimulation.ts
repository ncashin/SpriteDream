import type { GameObject, ScenePath } from "../../scene/scene.js";

type SceneReflectUpdate = { property: PropertyKey; path: ScenePath };

export const OWNER_ID = "__ownerId" as const;

export function isOwnedSceneObject(
  object: GameObject,
  peerIdentifier: string,
): boolean {
  return object[OWNER_ID] === peerIdentifier;
}

export function isOwnedSceneUpdate(
  update: SceneReflectUpdate,
  peerIdentifier: string,
): boolean {
  if (String(update.property) === peerIdentifier) return true;
  if (update.path.length > 0 && String(update.path[0]) === peerIdentifier) return true;
  return false;
}

export function withOwnership<T extends Record<string, unknown>>(
  object: T,
  peerIdentifier: string,
): T & Record<typeof OWNER_ID, string> {
  return { ...object, [OWNER_ID]: peerIdentifier };
}

export function peerIntegratesPhysicsForObject(
  object: GameObject,
  localPeerIdentifier: string,
): boolean {
  const owner = object[OWNER_ID];
  if (typeof owner !== "string") return true;
  return owner === localPeerIdentifier;
}
