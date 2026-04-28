import type { BodyType } from "planck";
import type { BaseSceneObject } from "../scene/scene.js";

/** Scene/authored body mode (Unity Rigidbody2D BodyType). Defaults to `"static"` when omitted — e.g. box-only props. Planck uses this when creating bodies and each frame for transform sync. */
export function getSceneBodyType(obj: BaseSceneObject): BodyType {
  const raw = (obj as { collisionBody?: { type?: BodyType } }).collisionBody;
  const t = raw?.type;
  if (t === "static" || t === "kinematic" || t === "dynamic") return t;
  return "static";
}

export function sceneBodyIsStatic(obj: BaseSceneObject): boolean {
  return getSceneBodyType(obj) === "static";
}

export function sceneBodyIsKinematic(obj: BaseSceneObject): boolean {
  return getSceneBodyType(obj) === "kinematic";
}

export function sceneBodyIsDynamic(obj: BaseSceneObject): boolean {
  return getSceneBodyType(obj) === "dynamic";
}

/** Planck body type for this client: authored `dynamic` may become `kinematic` when `simulatesDynamics(obj)` is false. */
export function getEffectivePlanckBodyType(
  obj: BaseSceneObject,
  simulatesDynamics: (obj: BaseSceneObject) => boolean,
): BodyType {
  const sceneT = getSceneBodyType(obj);
  if (sceneT === "dynamic" && !simulatesDynamics(obj)) return "kinematic";
  return sceneT;
}
