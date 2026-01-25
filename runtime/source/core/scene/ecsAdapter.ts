import { getScene } from "./scene";
import {
  currySceneECSData,
  type Component,
  type Entity,
  type ComponentProxyHandler,
  type ComponentTypeString,
  curryECSInstance,
  type CurriedECSWithScene,
} from "../ecs/ecs";
import type { InitialGameContext, ContextExtension } from "../gameContext";
import { TransformComponentDefinition } from "../ecs/component";
import { setParent as setParentTransform } from "../transform";

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

  // Store reference to original entities for callbacks
  const originalEntities = ecsData.entities || {};

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
      if (originalEntities[entity] && originalEntities[entity][componentType]) {
        originalEntities[entity][componentType][property] = newValue;
      }

      return true;
    },
  };

  const ecs = currySceneECSData(originalEntities, {
    componentProxyHandler,
    defaultComponent: TransformComponentDefinition,
    setParentHandler: setParentTransform,
    createEntityCallback: (entity: Entity) => {
      if (!originalEntities[entity]) {
        originalEntities[entity] = {};
      }
    },
    addComponentCallback: (entity: Entity, component: Component) => {
      if (!originalEntities[entity]) {
        originalEntities[entity] = {};
      }
      const existingComponent = originalEntities[entity][component.type];
      if (existingComponent) {
        Object.assign(existingComponent, component);
      } else {
        originalEntities[entity][component.type] = JSON.parse(JSON.stringify(component));
      }
    },
    removeComponentCallback: (entity: Entity, COMPONENT_TYPE_DEF: Component) => {
      const componentType = COMPONENT_TYPE_DEF.type;
      if (originalEntities[entity] && originalEntities[entity][componentType]) {
        delete originalEntities[entity][componentType];
      }
    },
    destroyEntityCallback: (entity: Entity) => {
      // Delete directly from original entities reference to ensure it persists
      if (originalEntities[entity]) {
        delete originalEntities[entity];
      }
    },
    renameEntityCallback: (oldEntity: Entity, newEntity: Entity) => {
      if (ecsData.entities[oldEntity]) {
        ecsData.entities[newEntity] = ecsData.entities[oldEntity];
        delete ecsData.entities[oldEntity];
      }
    },
  });

  // Create a proxy for scene.ecs that updates ECS when entities change
  const proxiedSceneECS = new Proxy(ecsData, {
    set: (target, property, value) => {
      if (property === "entities" && typeof value === "object" && value !== null && !Array.isArray(value)) {
        // When entities are replaced, update the ECS
        const result = Reflect.set(target, property, value);
        if (ecs && 'updateSceneEntities' in ecs) {
          (ecs as CurriedECSWithScene).updateSceneEntities(value as Record<Entity, Record<ComponentTypeString, Component>>);
        }
        return result;
      }
      return Reflect.set(target, property, value);
    },
    get: (target, property) => {
      const value = Reflect.get(target, property);
      // Proxy the entities object to track changes
      if (property === "entities" && value && typeof value === "object" && !Array.isArray(value)) {
        return new Proxy(value as Record<Entity, Record<ComponentTypeString, Component>>, {
          set: (entitiesTarget, entityKey, entityValue) => {
            const result = Reflect.set(entitiesTarget, entityKey, entityValue);
            // Update ECS when entities are added/modified
            if (ecs && 'updateSceneEntities' in ecs) {
              (ecs as CurriedECSWithScene).updateSceneEntities(entitiesTarget);
            }
            return result;
          },
          deleteProperty: (entitiesTarget, entityKey) => {
            const result = Reflect.deleteProperty(entitiesTarget, entityKey);
            // Update ECS when entities are deleted
            if (ecs && 'updateSceneEntities' in ecs) {
              (ecs as CurriedECSWithScene).updateSceneEntities(entitiesTarget);
            }
            return result;
          },
        });
      }
      return value;
    },
  });

  // Replace scene.ecs with the proxy
  scene.ecs = proxiedSceneECS as SceneECSData;

  const extendedContext = {
    ...context,
    ecs,
  };

  return extendedContext;
}

