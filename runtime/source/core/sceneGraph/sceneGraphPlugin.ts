import type { ContextExtension, RequirePlugin } from "../gameContext";
import type { Entity, EntityComponents } from "../ecs/ecs";
import { ecsPlugin } from "../scene/ecsAdapter";
import {
  getWorldPosition,
  getWorldTransform,
  getWorldRotation,
  getWorldScale,
  getTransform,
  setTransform,
  setWorldPosition,
  setWorldTransform,
  setParent,
  getChildren,
  getParents,
  moveEntityAndParents,
  worldDirectionToLocal,
  worldDistanceToLocal,
} from "../transform";

export type SceneGraphAPI = {
  getTransform: (entity: Entity | EntityComponents) => ReturnType<typeof getTransform>;
  getWorldTransform: (entity: Entity | EntityComponents) => ReturnType<typeof getWorldTransform>;
  getWorldPosition: (entity: Entity | EntityComponents) => ReturnType<typeof getWorldPosition>;
  getWorldRotation: (entity: Entity | EntityComponents) => ReturnType<typeof getWorldRotation>;
  getWorldScale: (entity: Entity | EntityComponents) => ReturnType<typeof getWorldScale>;
  setTransform: (entity: Entity, transform: Parameters<typeof setTransform>[2]) => void;
  setWorldPosition: (entity: Entity, worldX: number, worldY: number) => void;
  setWorldTransform: (
    entity: Entity,
    worldTransform: Parameters<typeof setWorldTransform>[2],
    overrideParent?: Entity | null
  ) => void;
  setParent: (entity: Entity, parentId: Entity | null) => void;
  getChildren: (entity: Entity) => Entity[];
  getParents: (entity: Entity) => Entity[];
  moveEntityAndParents: (entity: Entity, worldDeltaX: number, worldDeltaY: number) => void;
  worldDirectionToLocal: (entity: Entity, worldDirX: number, worldDirY: number) => { x: number; y: number };
  worldDistanceToLocal: (entity: Entity, worldDistance: number) => number;
};

export function sceneGraphPlugin<T extends RequirePlugin<[typeof ecsPlugin]>>(
  context: T
): ContextExtension<T, { sceneGraph: SceneGraphAPI }> {
  const { ecs } = context;
  const sceneGraph: SceneGraphAPI = {
    getTransform: (entity) => getTransform(ecs.ecsInstance, entity),
    getWorldTransform: (entity) => getWorldTransform(ecs.ecsInstance, entity),
    getWorldPosition: (entity) => getWorldPosition(ecs.ecsInstance, entity),
    getWorldRotation: (entity) => getWorldRotation(ecs.ecsInstance, entity),
    getWorldScale: (entity) => getWorldScale(ecs.ecsInstance, entity),
    setTransform: (entity, transform) => setTransform(ecs.ecsInstance, entity, transform),
    setWorldPosition: (entity, worldX, worldY) => setWorldPosition(ecs.ecsInstance, entity, worldX, worldY),
    setWorldTransform: (entity, worldTransform, overrideParent) =>
      setWorldTransform(ecs.ecsInstance, entity, worldTransform, overrideParent),
    setParent: (entity, parentId) => setParent(ecs.ecsInstance, entity, parentId),
    getChildren: (entity) => getChildren(ecs.ecsInstance, entity),
    getParents: (entity) => getParents(ecs.ecsInstance, entity),
    moveEntityAndParents: (entity, worldDeltaX, worldDeltaY) =>
      moveEntityAndParents(ecs.ecsInstance, entity, worldDeltaX, worldDeltaY),
    worldDirectionToLocal: (entity, worldDirX, worldDirY) =>
      worldDirectionToLocal(ecs.ecsInstance, entity, worldDirX, worldDirY),
    worldDistanceToLocal: (entity, worldDistance) =>
      worldDistanceToLocal(ecs.ecsInstance, entity, worldDistance),
  };

  return {
    ...context,
    sceneGraph,
  };
}

