import type { ECSInstance, Entity } from "../ecs/ecs";
import type { Vector } from "../vector";

export type CollisionCallback = (
  ecs: ECSInstance,
  entity: Entity,
  other: Entity,
  overlapAmount: number,
  overlapNormal: Vector
) => void;

export type CollisionCallbackDefinition = {
  name: string;
  callback: CollisionCallback;
};

export const collisionCallbackRegistry: Record<string, CollisionCallbackDefinition> = {};

export const registerCollisionCallback = (
  definition: CollisionCallbackDefinition
) => {
  collisionCallbackRegistry[definition.name] = definition;
};

export const unregisterCollisionCallback = (name: string) => {
  delete collisionCallbackRegistry[name];
};

export const getCollisionCallback = (
  name: string
): CollisionCallbackDefinition | undefined => {
  return collisionCallbackRegistry[name];
};

