export type Entity = string;
export type EntityLike = Entity | Record<string, Component>;
export type ComponentTypeString = string;
export type Component = { type: ComponentTypeString } & Record<string, unknown>;
export type EntityComponents = Record<ComponentTypeString, Component>;

export type ClickableEntityProvider = {
  checkClick: (worldX: number, worldY: number) => string | null;
};
export type ECSInstance = {
  entities: Record<Entity, EntityComponents>;
  composedPools: Record<ComponentTypeString, Entity[]>;
  associatedComposedPoolKeys: Record<ComponentTypeString, string[]>;

  selectedEntity: Entity | null;

  createEntityCallback?: (entity: Entity) => void;
  addComponentCallback?: (entity: Entity, component: Component) => void;
  removeComponentCallback?: (
    entity: Entity,
    COMPONENT_TYPE_DEF: Component,
  ) => void;
  destroyEntityCallback?: (entity: Entity) => void;
  renameEntityCallback?: (oldEntity: Entity, newEntity: Entity) => void;

  componentProxyHandler?: ComponentProxyHandler;
  defaultComponent?: Component;
  setParentHandler?: SetParentHandler;

  componentProxyCache: Map<Entity, Map<ComponentTypeString, Component>>;
  entityProxyCache: Map<Entity, Record<string, Component>>;
};

export type ComponentProxyHandler = {
  set: (
    entity: Entity,
    component: Component,
    property: string,
    newValue: unknown,
  ) => boolean;
};

export type SetParentHandler = (
  instance: ECSInstance,
  entity: Entity,
  parentId: Entity | null,
) => void;

export type ECSInstanceCreateInfo = {
  entities?: Record<Entity, EntityComponents>;
  createEntityCallback?: (entity: Entity) => void;
  addComponentCallback?: (entity: Entity, component: Component) => void;
  removeComponentCallback?: (
    entity: Entity,
    COMPONENT_TYPE_DEF: Component,
  ) => void;
  destroyEntityCallback?: (entity: Entity) => void;
  renameEntityCallback?: (oldEntity: Entity, newEntity: Entity) => void;
  componentProxyHandler?: ComponentProxyHandler;
  defaultComponent?: Component;
  setParentHandler?: SetParentHandler;
};

export const invalidateComposedPools = (instance: ECSInstance) => {
  instance.composedPools = {};
  instance.associatedComposedPoolKeys = {};
  instance.componentProxyCache.clear();
  instance.entityProxyCache.clear();
};

const createSceneEntitiesProxy = (
  sceneEntities: Record<Entity, EntityComponents>,
  instance: ECSInstance,
): Record<Entity, EntityComponents> => {
  return new Proxy(sceneEntities, {
    set: (target, property, value) => {
      if (typeof property !== "string") {
        return Reflect.set(target, property, value);
      }
      const wasNew = !(property in target);
      const result = Reflect.set(target, property, value);
      if (!wasNew && value && typeof value === "object" && !Array.isArray(value)) {
        invalidateComposedPools(instance);
      }
      return result;
    },
    deleteProperty: (target, property) => {
      if (typeof property !== "string") {
        return Reflect.deleteProperty(target, property);
      }
      const hadProperty = property in target;
      const result = Reflect.deleteProperty(target, property);
      if (hadProperty && result) {
        invalidateComposedPools(instance);
      }
      return result;
    },
    get: (target, property) => {
      const value = Reflect.get(target, property);
      if (typeof property !== "string" || !value || typeof value !== "object" || Array.isArray(value)) {
        return value;
      }
      return new Proxy(value as EntityComponents, {
        set: (entityTarget, componentType, componentValue) => {
          if (typeof componentType !== "string") {
            return Reflect.set(entityTarget, componentType, componentValue);
          }
          // Don't invalidate composed pools here - the createEntityProxy setter
          // will handle incremental updates via updateComposedPoolsForComponent
          // Skip invalidation - let the ECS API handle pool updates incrementally
          const result = Reflect.set(entityTarget, componentType, componentValue);
          return result;
        },
        deleteProperty: (entityTarget, componentType) => {
          if (typeof componentType !== "string") {
            return Reflect.deleteProperty(entityTarget, componentType);
          }
          // Component removal should invalidate since we need to remove from pools
          const result = Reflect.deleteProperty(entityTarget, componentType);
          invalidateComposedPools(instance);
          return result;
        },
      });
    },
  });
};

export const createECSInstance = (
  ecsInstanceCreateInfo: ECSInstanceCreateInfo,
): ECSInstance => {
  const { entities: providedEntities, ...rest } = ecsInstanceCreateInfo;
  const baseEntities = providedEntities || {};

  const instance: ECSInstance = {
    entities: {},
    composedPools: {},
    associatedComposedPoolKeys: {},
    selectedEntity: null,
    componentProxyCache: new Map(),
    entityProxyCache: new Map(),
    ...rest,
  };

  // If entities are provided, proxy them to sync changes with ECS state
  if (providedEntities) {
    instance.entities = createSceneEntitiesProxy(baseEntities, instance);
  }

  return instance;
};

export const createEntity = (
  instance: ECSInstance,
  name: string,
): Record<string, Component> => {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Entity name is required and must be a non-empty string');
  }

  const wasNew = !instance.entities[name];
  const entityProxy = getEntity(instance, name);

  if (wasNew && instance.createEntityCallback) {
    instance.createEntityCallback(name);
  }

  if (instance.defaultComponent && !entityProxy[instance.defaultComponent.type]) {
    const defaultComponent = structuredClone(instance.defaultComponent);
    entityProxy[instance.defaultComponent.type] = defaultComponent;
  }

  return entityProxy;
};
const resolveEntityId = (
  instance: ECSInstance,
  entity: EntityLike,
): Entity | null => {
  if (typeof entity === "string") {
    return entity;
  }

  for (const [entityId, proxy] of instance.entityProxyCache.entries()) {
    if (proxy === entity) {
      return entityId;
    }
  }

  for (const [entityId, components] of Object.entries(instance.entities)) {
    if (components === entity) {
      return entityId;
    }
  }

  return null;
};

export const destroyEntity = (instance: ECSInstance, entity: EntityLike) => {
  const entityId = resolveEntityId(instance, entity);
  if (!entityId) {
    return;
  }

  if (instance.selectedEntity === entityId) {
    instance.selectedEntity = null;
  }

  for (const composedPool of Object.values(instance.composedPools)) {
    const index = composedPool.indexOf(entityId);
    if (index !== -1) {
      composedPool.splice(index, 1);
    }
  }

  instance.componentProxyCache.delete(entityId);
  instance.entityProxyCache.delete(entityId);

  delete instance.entities[entityId];

  if (!instance.destroyEntityCallback) return;
  instance.destroyEntityCallback(entityId);
};

export const renameEntity = (
  instance: ECSInstance,
  oldEntity: Entity,
  newEntity: Entity,
): boolean => {
  instance.entities[newEntity] = instance.entities[oldEntity];
  delete instance.entities[oldEntity];

  for (const composedPool of Object.values(instance.composedPools)) {
    const index = composedPool.indexOf(oldEntity);
    if (index !== -1) {
      composedPool[index] = newEntity;
    }
  }

  const componentCache = instance.componentProxyCache.get(oldEntity);
  if (componentCache) {
    instance.componentProxyCache.set(newEntity, componentCache);
    instance.componentProxyCache.delete(oldEntity);
  }
  instance.entityProxyCache.delete(oldEntity);

  if (instance.selectedEntity === oldEntity) {
    instance.selectedEntity = newEntity;
  }

  if (instance.renameEntityCallback) {
    instance.renameEntityCallback(oldEntity, newEntity);
  }

  return true;
};

const lookupComponent = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  const entityComponents = instance.entities[entity];
  if (!entityComponents) {
    return undefined;
  }
  return entityComponents[COMPONENT_TYPE_DEF.type] as ComponentType | undefined;
};

const ensureEntity = (instance: ECSInstance, entity: Entity): EntityComponents => {
  if (!instance.entities[entity]) {
    instance.entities[entity] = {};
  }
  return instance.entities[entity];
};

const createComponentReference = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  const entityComponents = ensureEntity(instance, entity);
  const existingComponent = entityComponents[COMPONENT_TYPE_DEF.type];
  if (existingComponent) {
    Object.assign(existingComponent, COMPONENT_TYPE_DEF);
    return;
  }
  entityComponents[COMPONENT_TYPE_DEF.type] = structuredClone(COMPONENT_TYPE_DEF);
};

export const addComponent = <
  ComponentType extends Component,
  UpdatedProperties extends Partial<ComponentType>,
>(
  entity: Record<string, Component>,
  componentDefinition: ComponentType,
  updatedProperties: UpdatedProperties = {} as UpdatedProperties,
): Record<string, Component> => {
  const mergedComponent = {
    ...componentDefinition,
    ...updatedProperties,
  } as ComponentType;
  entity[componentDefinition.type] = mergedComponent;
  return entity;
};

const updateComposedPoolsForComponent = (
  instance: ECSInstance,
  entity: Entity,
  componentType: ComponentTypeString,
) => {
  const componentDef = { type: componentType };
  for (const keyToUpdate of lookupAssociatedComposedPoolKeys(instance, componentDef)) {
    const parsedKeyComponentTypes = keyToUpdate.split(" ");
    const composedComponents = [];
    for (let i = 0; i < parsedKeyComponentTypes.length; i++) {
      const component = lookupComponent(instance, entity, {
        type: parsedKeyComponentTypes[i],
      });
      if (component === undefined) continue;
      composedComponents.push(component);
    }
    if (composedComponents.length !== parsedKeyComponentTypes.length) continue;
    if (!instance.composedPools[keyToUpdate]) {
      instance.composedPools[keyToUpdate] = [];
    }
    if (instance.composedPools[keyToUpdate].includes(entity)) continue;
    instance.composedPools[keyToUpdate].push(entity);
  }
};

const removeFromComposedPools = (
  instance: ECSInstance,
  entity: Entity,
  componentType: ComponentTypeString,
) => {
  const componentDef = { type: componentType };
  for (const keyToUpdate of lookupAssociatedComposedPoolKeys(instance, componentDef)) {
    if (!instance.composedPools[keyToUpdate]) continue;
    const index = instance.composedPools[keyToUpdate].indexOf(entity);
    if (index === -1) continue;
    instance.composedPools[keyToUpdate].splice(index, 1);
  }
};

const createEntityProxy = (
  instance: ECSInstance,
  entity: Entity,
): Record<string, Component> => {
  const cached = instance.entityProxyCache.get(entity);
  if (cached) return cached;

  const entityComponents = ensureEntity(instance, entity);

  const proxy = new Proxy(entityComponents, {
    get: (target, property) => {
      if (typeof property !== "string") {
        return Reflect.get(target, property);
      }

      const component = target[property];
      if (!component || !instance.componentProxyHandler) {
        return component;
      }
      return createComponentProxy(instance, entity, component);
    },

    set: (target, property, value) => {
      if (typeof property !== "string") {
        return false;
      }

      const component = value as Component;
      if (!component || typeof component !== "object" || !component.type) {
        return false;
      }

      if (component.type !== property) {
        return false;
      }

      const wasNew = !target[property];
      createComponentReference(instance, entity, component);
      updateComposedPoolsForComponent(instance, entity, component.type);

      if (wasNew && instance.addComponentCallback) {
        const addedComponent = lookupComponent(instance, entity, component);
        if (addedComponent) {
          instance.addComponentCallback(entity, addedComponent);
        }
      }

      return true;
    },

    deleteProperty: (target, property) => {
      if (typeof property !== "string") {
        return false;
      }

      const component = target[property];
      if (!component) {
        return false;
      }

      removeFromComposedPools(instance, entity, property);

      if (instance.removeComponentCallback) {
        instance.removeComponentCallback(entity, component);
      }

      delete target[property];
      return true;
    },

    has: (target, property) => {
      return property in target;
    },

    ownKeys: (target) => {
      return Reflect.ownKeys(target);
    },

    getOwnPropertyDescriptor: (target, property) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (descriptor) {
        return {
          ...descriptor,
          enumerable: true,
          configurable: true,
        };
      }
      return descriptor;
    },
  });

  instance.entityProxyCache.set(entity, proxy);
  return proxy;
};
const lookupAssociatedComposedPoolKeys = <ComponentType extends Component>(
  instance: ECSInstance,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  if (
    instance.associatedComposedPoolKeys[COMPONENT_TYPE_DEF.type] !== undefined
  ) {
    return instance.associatedComposedPoolKeys[COMPONENT_TYPE_DEF.type];
  }
  instance.associatedComposedPoolKeys[COMPONENT_TYPE_DEF.type] = [];
  return instance.associatedComposedPoolKeys[COMPONENT_TYPE_DEF.type];
};

export const createComponentProxy = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  const component = lookupComponent(instance, entity, COMPONENT_TYPE_DEF);
  if (!component) return undefined;

  let entityCache = instance.componentProxyCache.get(entity);
  if (entityCache) {
    const cached = entityCache.get(COMPONENT_TYPE_DEF.type);
    if (cached) return cached as ComponentType;
  }

  const proxy = new Proxy(component, {
    set: (target, property, newValue, _receiver) => {
      if (typeof property !== "string") {
        throw new Error("property is not a string");
      }

      if (instance.componentProxyHandler === undefined) {
        throw new Error("componentProxyHandler is undefined");
      }

      return instance.componentProxyHandler.set(
        entity,
        target,
        property,
        newValue,
      );
    },
  });

  if (!entityCache) {
    entityCache = new Map();
    instance.componentProxyCache.set(entity, entityCache);
  }
  entityCache.set(COMPONENT_TYPE_DEF.type, proxy);

  return proxy;
};

export const getComponent = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
): ComponentType | undefined => {
  if (instance.componentProxyHandler === undefined) {
    return lookupComponent(instance, entity, COMPONENT_TYPE_DEF);
  }
  return createComponentProxy(instance, entity, COMPONENT_TYPE_DEF);
};

type EntityWithComponents<ComposedType extends readonly Component[]> = Record<string, Component> & {
  [K in ComposedType[number]as K['type']]: K;
};

type UnknownExtraProps = { [k: string]: unknown };

export function getEntity(
  instance: ECSInstance,
  entity: Entity,
): Record<string, Component>;
export function getEntity<const ComposedType extends readonly Component[]>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEFS: ComposedType,
): (EntityWithComponents<ComposedType> & UnknownExtraProps) | undefined;
export function getEntity<const ComposedType extends readonly Component[]>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEFS?: ComposedType,
): Record<string, Component> | (EntityWithComponents<ComposedType> & UnknownExtraProps) | undefined {
  if (COMPONENT_TYPE_DEFS !== undefined) {
    if (!instance.entities[entity]) {
      return undefined;
    }
    const entityProxy = createEntityProxy(instance, entity) as EntityWithComponents<ComposedType> & UnknownExtraProps;
    if (!hasComponents(entityProxy, COMPONENT_TYPE_DEFS as unknown as Component[])) {
      return undefined;
    }
    return entityProxy;
  }

  return createEntityProxy(instance, entity);
}

export const queryEntities = <const ComposedType extends Component[]>(
  instance: ECSInstance,
  COMPONENT_TYPE_DEFS: ComposedType,
): Entity[] => {
  const combination = COMPONENT_TYPE_DEFS.map(
    (COMPONENT_TYPE_DEF) => COMPONENT_TYPE_DEF.type,
  ).reduce((previous, current) => `${previous} ${current}`);

  if (instance.composedPools[combination] !== undefined) {
    return instance.composedPools[combination];
  }

  const poolEntities: Entity[] = [];
  const componentTypes = COMPONENT_TYPE_DEFS.map(
    (COMPONENT_TYPE_DEF) => COMPONENT_TYPE_DEF.type,
  );

  for (const COMPONENT_TYPE_DEF of COMPONENT_TYPE_DEFS) {
    lookupAssociatedComposedPoolKeys(instance, COMPONENT_TYPE_DEF).push(
      combination,
    );
  }

  for (const [entityID, entityComponents] of Object.entries(instance.entities)) {
    let hasAllComponents = true;

    for (const componentType of componentTypes) {
      if (entityComponents[componentType] === undefined) {
        hasAllComponents = false;
        break;
      }
    }

    if (!hasAllComponents) continue;
    poolEntities.push(entityID);
  }

  instance.composedPools[combination] = poolEntities;
  return instance.composedPools[combination];
};

export const runQuery = <const ComposedType extends Component[]>(
  instance: ECSInstance,
  COMPONENT_TYPE_DEFS: ComposedType,
  lambda: (entity: Entity, data: EntityWithComponents<ComposedType>) => void,
) => {
  const entities = queryEntities(instance, COMPONENT_TYPE_DEFS);

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const entityProxy = createEntityProxy(instance, entity) as EntityWithComponents<ComposedType>;
    lambda(entity, entityProxy);
  }
};

export const selectEntity = (instance: ECSInstance, entity: Entity | null) => {
  if (entity !== null && !instance.entities[entity]) {
    return;
  }
  instance.selectedEntity = entity;
};

export const getSelectedEntity = (instance: ECSInstance): Entity | null => {
  return instance.selectedEntity;
};

export const clearSelection = (instance: ECSInstance) => {
  instance.selectedEntity = null;
};

export const curryECSInstance = (instance: ECSInstance) => ({
  ecsInstance: instance,

  createEntity: (name: string): Record<string, Component> =>
    createEntity(instance, name),
  destroyEntity: (entity: EntityLike) => destroyEntity(instance, entity),
  renameEntity: (oldEntity: Entity, newEntity: Entity): boolean =>
    renameEntity(instance, oldEntity, newEntity),

  getComponent: <ComponentType extends Component>(
    entity: Entity,
    COMPONENT_TYPE_DEF: ComponentType,
  ): ComponentType | undefined =>
    getComponent(instance, entity, COMPONENT_TYPE_DEF),
  addComponent: <
    ComponentType extends Component,
    UpdatedProperties extends Partial<ComponentType>,
  >(
    entity: Record<string, Component>,
    componentDefinition: ComponentType,
    updatedProperties: UpdatedProperties,
  ): Record<string, Component> =>
    addComponent(entity, componentDefinition, updatedProperties),
  getEntity: (<const ComposedType extends readonly Component[]>(
    entity: Entity,
    COMPONENT_TYPE_DEFS?: ComposedType,
  ):
    | (EntityWithComponents<ComposedType> & UnknownExtraProps)
    | Record<string, Component>
    | undefined => {
    if (COMPONENT_TYPE_DEFS !== undefined) {
      return getEntity(instance, entity, COMPONENT_TYPE_DEFS) as EntityWithComponents<ComposedType> & UnknownExtraProps;
    }
    return getEntity(instance, entity);
  }) as {
    (entity: Entity): Record<string, Component>;
    <const ComposedType extends readonly Component[]>(
      entity: Entity,
      COMPONENT_TYPE_DEFS: ComposedType,
    ): (EntityWithComponents<ComposedType> & UnknownExtraProps) | undefined;
  },
  hasComponents: <const ComposedType extends Component[]>(
    entityData: Record<string, Component>,
    COMPONENT_TYPE_DEFS: ComposedType,
  ): entityData is EntityWithComponents<ComposedType> =>
    hasComponents(entityData, COMPONENT_TYPE_DEFS),
  queryEntities: <const ComposedType extends Component[]>(
    COMPONENT_TYPE_DEFS: ComposedType,
  ) => queryEntities(instance, COMPONENT_TYPE_DEFS),

  runQuery: <const ComposedType extends Component[]>(
    COMPONENT_TYPE_DEFS: ComposedType,
    lambda: (entity: Entity, data: EntityWithComponents<ComposedType>) => void,
  ) => runQuery(instance, COMPONENT_TYPE_DEFS, lambda),

  selectEntity: (entity: Entity | null) => selectEntity(instance, entity),
  getSelectedEntity: (): Entity | null => getSelectedEntity(instance),
  clearSelection: () => clearSelection(instance),

  setParent: (entity: Entity, parentId: Entity | null) =>
    setParent(instance, entity, parentId),
});

export const setParent = (
  instance: ECSInstance,
  entity: Entity,
  parentId: Entity | null,
): void => {
  if (!instance.setParentHandler) return;
  instance.setParentHandler(instance, entity, parentId);
};

export const hasComponents = <const ComposedType extends Component[]>(
  entityData: Record<string, Component>,
  COMPONENT_TYPE_DEFS: ComposedType,
): entityData is EntityWithComponents<ComposedType> => {
  for (const COMPONENT_TYPE_DEF of COMPONENT_TYPE_DEFS) {
    if (!entityData[COMPONENT_TYPE_DEF.type]) {
      return false;
    }
  }

  return true;
};

export type CurriedECSWithScene = ReturnType<typeof curryECSInstance> & {
  _originalEntities: Record<Entity, EntityComponents>;
  updateSceneEntities: (newEntities: Record<Entity, EntityComponents>) => void;
};

export const currySceneECSData = (
  sceneEntities: Record<Entity, EntityComponents>,
  ecsInstanceCreateInfo?: ECSInstanceCreateInfo,
): CurriedECSWithScene => {
  const ecsInstance = createECSInstance(ecsInstanceCreateInfo ?? {});
  const originalEntities = sceneEntities;
  ecsInstance.entities = createSceneEntitiesProxy(sceneEntities, ecsInstance);
  const curried = curryECSInstance(ecsInstance) as CurriedECSWithScene;

  curried._originalEntities = originalEntities;
  curried.updateSceneEntities = (newEntities: Record<Entity, EntityComponents>) => {
    curried._originalEntities = newEntities;
    ecsInstance.entities = createSceneEntitiesProxy(newEntities, ecsInstance);
    invalidateComposedPools(ecsInstance);
    if (ecsInstance.selectedEntity && !newEntities[ecsInstance.selectedEntity]) {
      ecsInstance.selectedEntity = null;
    }
  };

  return curried;
};

export const provideECSInstanceFunctions = (
  ecsInstanceCreateInfo?: ECSInstanceCreateInfo,
) => {
  const ecsInstance = createECSInstance(ecsInstanceCreateInfo ?? {});

  return curryECSInstance(ecsInstance);
};
