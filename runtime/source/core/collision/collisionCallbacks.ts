import type { Component, ECSInstance } from "../ecs/ecs";
import type { Vector } from "../vector";

export type CollisionCallbackArgs = {
  ecs: ECSInstance;
  entity: Record<string, Component>;
  other: Record<string, Component>;
  overlapAmount: number;
  overlapNormal: Vector;
};

export type CollisionCallback = (args: CollisionCallbackArgs) => void;

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

