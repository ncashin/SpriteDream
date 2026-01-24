import { getScene } from "../scene/scene";
import {
  currySceneECSData,
  invalidateComposedPools,
  type Component,
  type Entity,
  type ComponentProxyHandler,
  type ComponentTypeString,
  curryECSInstance,
} from "../ecs/ecs";
import type { InitialGameContext, ContextExtension } from "../gameContext";
import { TransformComponentDefinition } from "../ecs/component";
import { setParent as setParentTransform } from "../transform";
import { undoRedoManager } from "./undoRedo";

type SceneECSData = {
  entities: Record<Entity, Record<ComponentTypeString, Component>>;
};

type LegacySceneECSData = {
  componentPools: Record<ComponentTypeString, Record<Entity, Component>>;
};

type EntitiesArrayFormat = {
  entities: Array<{ id: Entity } & Record<ComponentTypeString, Component>>;
};

function isSceneECSData(value: unknown): value is SceneECSData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.entities !== "object" || obj.entities === null) {
    return false;
  }
  // Check if entities is an array (entities array format)
  if (Array.isArray(obj.entities)) {
    return false; // This is the array format, not the object format
  }
  return true;
}

function isEntitiesArrayFormat(value: unknown): value is EntitiesArrayFormat {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.entities);
}

function migrateEntitiesArrayFormat(arrayData: EntitiesArrayFormat): SceneECSData {
  const entities: Record<Entity, Record<ComponentTypeString, Component>> = {};

  // Convert entities array format to object format
  for (const entityObj of arrayData.entities) {
    const entityId = entityObj.id;
    if (!entityId || typeof entityId !== 'string') {
      continue; // Skip invalid entities
    }

    // Copy all components (excluding the 'id' field)
    const components: Record<ComponentTypeString, Component> = {};
    for (const [key, value] of Object.entries(entityObj)) {
      if (key !== 'id' && typeof value === 'object' && value !== null) {
        components[key] = value as Component;
      }
    }

    entities[entityId] = components;
  }

  return { entities };
}

function isLegacySceneECSData(value: unknown): value is LegacySceneECSData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.componentPools !== "object" || obj.componentPools === null) {
    return false;
  }
  return true;
}

function migrateLegacyECSData(legacyData: LegacySceneECSData): SceneECSData {
  const entities: Record<Entity, Record<ComponentTypeString, Component>> = {};

  // Convert componentPools format to entities format
  for (const [componentType, componentPool] of Object.entries(legacyData.componentPools)) {
    for (const [entity, component] of Object.entries(componentPool)) {
      if (!entities[entity]) {
        entities[entity] = {};
      }
      entities[entity][componentType] = component;
    }
  }

  return { entities };
}

export function initializeSceneECS<T extends InitialGameContext>(
  context: T
): ContextExtension<T, { ecs: ReturnType<typeof curryECSInstance> }> {
  const scene = getScene();

  let ecsData: SceneECSData;

  if (!scene.ecs) {
    scene.ecs = {
      entities: {},
    };
    ecsData = { entities: {} };
  } else if (isSceneECSData(scene.ecs)) {
    ecsData = scene.ecs;
  } else if (isEntitiesArrayFormat(scene.ecs)) {
    // Migrate from entities array format to object format
    ecsData = migrateEntitiesArrayFormat(scene.ecs);
    scene.ecs = ecsData;
  } else if (isLegacySceneECSData(scene.ecs)) {
    // Migrate from old componentPools format to new entities format
    ecsData = migrateLegacyECSData(scene.ecs);
    scene.ecs = ecsData;
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
      if (originalEntities[oldEntity]) {
        originalEntities[newEntity] = originalEntities[oldEntity];
        delete originalEntities[oldEntity];
      }
    },
  });

  // Register callback to update ECS instance after undo/redo
  undoRedoManager.setECSUpdateCallback(() => {
    // Update the ECS instance's entities reference to point to the restored scene data
    // Note: originalEntities and ecsData.entities are the same reference
    if ((ecs as any).updateSceneEntities) {
      (ecs as any).updateSceneEntities(originalEntities);
    } else {
      ecs.ecsInstance.entities = originalEntities;
      invalidateComposedPools(ecs.ecsInstance);
    }
  });

  return {
    ...context,
    ecs,
  };
}


