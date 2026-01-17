import { getScene } from "./scene";
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
import { initializeECSEditor } from "../ecs/editor/ECSEditorPlugin";

type SceneECSData = {
  entities: Record<Entity, Record<ComponentTypeString, Component>>;
};

export function ecsPlugin<T extends InitialGameContext>(
  context: T
): ContextExtension<T, { ecs: ReturnType<typeof curryECSInstance> }> {
  const scene = getScene();

  let ecsData: SceneECSData;
  
  if (!scene.ecs) {
    scene.ecs = {
      entities: {},
    };
    ecsData = { entities: {} };
  } else if (
    typeof scene.ecs === "object" &&
    scene.ecs !== null &&
    "entities" in scene.ecs &&
    typeof scene.ecs.entities === "object" &&
    scene.ecs.entities !== null &&
    !Array.isArray(scene.ecs.entities)
  ) {
    ecsData = scene.ecs as SceneECSData;
  } else {
    ecsData = { entities: {} };
    scene.ecs = ecsData;
  }

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
      if (ecsData.entities[entity] && ecsData.entities[entity][componentType]) {
        ecsData.entities[entity][componentType][property] = newValue;
      }
      
      return true;
    },
  };

  const ecsInstance: ECSInstance = createECSInstance({
    componentProxyHandler,
    addComponentCallback: (entity: Entity, component: Component) => {
      if (!ecsData.entities[entity]) {
        ecsData.entities[entity] = {};
      }
      const existingComponent = ecsData.entities[entity][component.type];
      if (existingComponent) {
        Object.assign(existingComponent, component);
      } else {
        ecsData.entities[entity][component.type] = JSON.parse(JSON.stringify(component));
      }
    },
    removeComponentCallback: (entity: Entity, COMPONENT_TYPE_DEF: Component) => {
      const componentType = COMPONENT_TYPE_DEF.type;
      if (ecsData.entities[entity] && ecsData.entities[entity][componentType]) {
        delete ecsData.entities[entity][componentType];
      }
    },
    destroyEntityCallback: (entity: Entity) => {
      delete ecsData.entities[entity];
    },
  });

  ecsInstance.entities = ecsData.entities || {};

  const ecs = curryECSInstance(ecsInstance);

  const extendedContext = {
    ...context,
    ecs,
  };

  // Initialize editor plugin if in dev mode
  initializeECSEditor(extendedContext);

  return extendedContext;
}

