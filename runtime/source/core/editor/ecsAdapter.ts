import { getScene } from "../scene/scene";
import {
  createECSInstance,
  curryECSInstance,
  type ECSInstance,
  type Component,
  type Entity,
  type ComponentProxyHandler,
  type ComponentTypeString,
} from "../ecs/ecs";
import type { InitialGameContext, ContextExtension } from "../gameContext";

type SceneECSData = {
  componentPools: Record<ComponentTypeString, Record<Entity, Component>>;
};

function isSceneECSData(value: unknown): value is SceneECSData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.componentPools !== "object" || obj.componentPools === null) {
    return false;
  }
  return true;
}

export function initializeSceneECS<T extends InitialGameContext>(
  context: T
): ContextExtension<T, { ecs: ReturnType<typeof curryECSInstance> }> {
  const scene = getScene();

  if (!scene.ecs || !isSceneECSData(scene.ecs)) {
    scene.ecs = {
      componentPools: {},
    };
  }

  const ecsData: SceneECSData = isSceneECSData(scene.ecs) 
    ? scene.ecs 
    : { componentPools: {} };

  const componentProxyHandler: ComponentProxyHandler = {
    set: (entity: Entity, component: Component, property: string, newValue: unknown): boolean => {
      if (property in component) {
        (component as Record<string, unknown>)[property] = newValue;
      } else {
        Object.defineProperty(component, property, {
          value: newValue,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      
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
      const existingComponent = ecsData.componentPools[componentType][entity];
      if (existingComponent) {
        Object.assign(existingComponent, component);
      } else {
        ecsData.componentPools[componentType][entity] = JSON.parse(JSON.stringify(component));
      }
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

  const ecs = curryECSInstance(ecsInstance);

  return {
    ...context,
    ecs,
  };
}

