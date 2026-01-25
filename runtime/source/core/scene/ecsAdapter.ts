import { getScene } from "./scene";
import {
  currySceneECSData,
  type Component,
  type Entity,
  type ComponentProxyHandler,
  type ComponentTypeString,
} from "../ecs/ecs";
import type { InitialGameContext, ContextExtension } from "../gameContext";
import { TransformComponentDefinition } from "../ecs/component";
import { setParent as setParentTransform } from "../transform";

type SceneECSData = {
  entities: Record<Entity, Record<ComponentTypeString, Component>>;
};

/**
 * Migrate position components to transform components
 * This ensures backward compatibility with old scene files
 */
function migratePositionToTransform(ecsData: SceneECSData): void {
  for (const entityId in ecsData.entities) {
    const entity = ecsData.entities[entityId];
    if (entity.position && !entity.transform) {
      const position = entity.position as { x?: number; y?: number; type?: string };
      entity.transform = {
        type: "transform",
        x: typeof position.x === "number" ? position.x : 0,
        y: typeof position.y === "number" ? position.y : 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      // Keep position for backward compatibility, but prefer transform
    }
  }
}

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

  // Migrate position components to transform components
  migratePositionToTransform(ecsData);

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

  const extendedContext = {
    ...context,
    ecs,
  };

  return extendedContext;
}

