import { getScene } from "./scene";
import {
  createECSInstance,
  curryECSInstance,
  type ECSInstance,
  type Component,
  type Entity,
  type ComponentProxyHandler,
} from "../ecs/ecs";
import type { InitialGameContext, ContextExtension } from "../gameContext";

export function initializeSceneECS<T extends InitialGameContext>(
  context: T
): ContextExtension<T, { ecs: ReturnType<typeof curryECSInstance> }> {
  const scene = getScene();

  if (!scene.ecs) {
    scene.ecs = {
      entityIDCounter: 0,
      componentPools: {},
    };
  }

  const ecsData = scene.ecs;

  const componentProxyHandler: ComponentProxyHandler = {
    set: (entity: Entity, component: Component, property: string, newValue: unknown): boolean => {
      (component as any)[property] = newValue;
      
      const componentType = component.type;
      if (ecsData.componentPools[componentType] && ecsData.componentPools[componentType][entity]) {
        ecsData.componentPools[componentType][entity][property] = newValue;
      }
      
      return true;
    },
  };

  const ecsInstance: ECSInstance = createECSInstance({
    componentProxyHandler,
    addComponentCallback: (entity: Entity, component: Component) => {
      const componentType = component.type;
      if (!ecsData.componentPools[componentType]) {
        ecsData.componentPools[componentType] = {};
      }
      ecsData.componentPools[componentType][entity] = JSON.parse(JSON.stringify(component));
    },
    removeComponentCallback: (entity: Entity, COMPONENT_TYPE_DEF: Component) => {
      const componentType = COMPONENT_TYPE_DEF.type;
      if (ecsData.componentPools[componentType] && ecsData.componentPools[componentType][entity]) {
        delete ecsData.componentPools[componentType][entity];
      }
    },
    destroyEntityCallback: (entity: Entity) => {
      for (const componentType in ecsData.componentPools) {
        if (ecsData.componentPools[componentType][entity] !== undefined) {
          delete ecsData.componentPools[componentType][entity];
        }
      }
    },
  });

  ecsInstance.componentPools = ecsData.componentPools || {};

  Object.defineProperty(ecsInstance, "entityIDCounter", {
    get: () => ecsData.entityIDCounter || 0,
    set: (value: number) => {
      ecsData.entityIDCounter = value;
    },
    enumerable: true,
    configurable: true,
  });

  if (ecsData.entityIDCounter === undefined) {
    ecsData.entityIDCounter = 0;
  }

  const ecs = curryECSInstance(ecsInstance);

  return {
    ...context,
    ecs,
  };
}

