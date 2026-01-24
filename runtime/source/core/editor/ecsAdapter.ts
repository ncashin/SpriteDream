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
import { TransformComponentDefinition } from "../ecs/component";
import { setParent as setParentTransform } from "../transform";

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
    defaultComponent: TransformComponentDefinition,
    setParentHandler: setParentTransform,
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
    renameEntityCallback: (oldEntity: Entity, newEntity: Entity) => {
      if (ecsData.entities[oldEntity]) {
        ecsData.entities[newEntity] = ecsData.entities[oldEntity];
        delete ecsData.entities[oldEntity];
      }
    },
  });

  ecsInstance.entities = ecsData.entities || {};

  const ecs = curryECSInstance(ecsInstance);

  return {
    ...context,
    ecs,
  };
}


