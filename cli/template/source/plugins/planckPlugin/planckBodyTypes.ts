import type { BodyType } from "planck";
import type { GameObject } from "gameide";

export function getSceneBodyType(object: GameObject): BodyType {
  const raw = (object as { collisionBody?: { type?: BodyType } }).collisionBody;
  const declaredType = raw?.type;
  if (
    declaredType === "static" ||
    declaredType === "kinematic" ||
    declaredType === "dynamic"
  ) {
    return declaredType;
  }
  return "static";
}

export function sceneBodyIsStatic(object: GameObject): boolean {
  return getSceneBodyType(object) === "static";
}

export function sceneBodyIsKinematic(object: GameObject): boolean {
  return getSceneBodyType(object) === "kinematic";
}

export function sceneBodyIsDynamic(object: GameObject): boolean {
  return getSceneBodyType(object) === "dynamic";
}

export function getEffectivePlanckBodyType(
  object: GameObject,
  simulatesDynamics: (object: GameObject) => boolean,
): BodyType {
  const sceneBodyType = getSceneBodyType(object);
  if (sceneBodyType === "dynamic" && !simulatesDynamics(object)) return "kinematic";
  return sceneBodyType;
}
