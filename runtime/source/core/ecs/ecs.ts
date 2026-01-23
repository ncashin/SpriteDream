export type Entity = string;
export type ComponentTypeString = string;
export type Component = { type: ComponentTypeString } & Record<string, unknown>;
export type EntityComponents = Record<ComponentTypeString, Component>;

export type ClickableEntityProvider = {
  checkClick: (worldX: number, worldY: number) => string | null;
};
export type ECSInstance = {
  entities: Record<Entity, EntityComponents>;
  composedPools: Record<ComponentTypeString, Record<Entity, Component[]>>;
  associatedComposedPoolKeys: Record<ComponentTypeString, string[]>;

  selectedEntity: Entity | null;

  addComponentCallback?: (entity: Entity, component: Component) => void;
  removeComponentCallback?: (
    entity: Entity,
    COMPONENT_TYPE_DEF: Component,
  ) => void;
  destroyEntityCallback?: (entity: Entity) => void;
  renameEntityCallback?: (oldEntity: Entity, newEntity: Entity) => void;

  componentProxyHandler?: ComponentProxyHandler;
};

export type ComponentProxyHandler = {
  set: (
    entity: Entity,
    component: Component,
    property: string,
    newValue: unknown,
  ) => boolean;
};

export type ECSInstanceCreateInfo = {
  addComponentCallback?: (entity: Entity, component: Component) => void;
  removeComponentCallback?: (
    entity: Entity,
    COMPONENT_TYPE_DEF: Component,
  ) => void;
  destroyEntityCallback?: (entity: Entity) => void;
  renameEntityCallback?: (oldEntity: Entity, newEntity: Entity) => void;
  componentProxyHandler?: ComponentProxyHandler;
};

export const createECSInstance = (
  ecsInstanceCreateInfo: ECSInstanceCreateInfo,
): ECSInstance => ({
  entities: {},
  composedPools: {},
  associatedComposedPoolKeys: {},
  selectedEntity: null,

  ...ecsInstanceCreateInfo,
});

export const createEntity = (_instance: ECSInstance, name: string): Entity => {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Entity name is required and must be a non-empty string');
  }
  return name;
};
export const destroyEntity = (instance: ECSInstance, entity: Entity) => {
  if (instance.selectedEntity === entity) {
    instance.selectedEntity = null;
  }

  for (const composedPool of Object.values(instance.composedPools)) {
    if (composedPool[entity] !== undefined) {
      delete composedPool[entity];
    }
  }

  delete instance.entities[entity];

  if (instance.destroyEntityCallback) {
    instance.destroyEntityCallback(entity);
  }
};

export const renameEntity = (
  instance: ECSInstance,
  oldEntity: Entity,
  newEntity: Entity,
): boolean => {

  instance.entities[newEntity] = instance.entities[oldEntity];
  delete instance.entities[oldEntity];

  for (const composedPool of Object.values(instance.composedPools)) {
    if (composedPool[oldEntity] !== undefined) {
      composedPool[newEntity] = composedPool[oldEntity];
      delete composedPool[oldEntity];
    }
  }

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
  } else {
    entityComponents[COMPONENT_TYPE_DEF.type] = structuredClone(COMPONENT_TYPE_DEF);
  }
};
const lookupAssociatedComposedPoolKeys = <ComponentType extends Component>(
  instance: ECSInstance,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  if (
    instance.associatedComposedPoolKeys[COMPONENT_TYPE_DEF.type] === undefined
  ) {
    instance.associatedComposedPoolKeys[COMPONENT_TYPE_DEF.type] = [];
  }
  return instance.associatedComposedPoolKeys[COMPONENT_TYPE_DEF.type];
};

export const createComponentProxy = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  const component = lookupComponent(instance, entity, COMPONENT_TYPE_DEF);
  if (!component) return undefined;
  return new Proxy(component, {
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
};

export const getComponent = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
): ComponentType | undefined => {
  if (instance.componentProxyHandler !== undefined) {
    return createComponentProxy(instance, entity, COMPONENT_TYPE_DEF);
  }
  return lookupComponent(instance, entity, COMPONENT_TYPE_DEF);
};

export const getEntity = (
  instance: ECSInstance,
  entity: Entity,
): Record<string, Component> => {
  return instance.entities[entity] || {};
};
export const addComponent = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  createComponentReference(instance, entity, COMPONENT_TYPE_DEF);

  for (const keyToUpdate of lookupAssociatedComposedPoolKeys(
    instance,
    COMPONENT_TYPE_DEF,
  )) {
    const parsedKeyComponentTypes = keyToUpdate.split(" ");
    const composedComponents = [];
    for (let i = 0; i < parsedKeyComponentTypes.length; i++) {
      const component = lookupComponent(instance, entity, {
        type: parsedKeyComponentTypes[i],
      });
      if (component === undefined) continue;
      composedComponents.push(component);
    }
    if (composedComponents.length === parsedKeyComponentTypes.length) {
      if (!instance.composedPools[keyToUpdate]) {
        instance.composedPools[keyToUpdate] = {};
      }
      instance.composedPools[keyToUpdate][entity] = composedComponents;
    }
  }

  if (instance.addComponentCallback) {
    const component = lookupComponent(instance, entity, COMPONENT_TYPE_DEF);
    if (component) {
      instance.addComponentCallback(entity, component);
    }
  }
};
export const removeComponent = <ComponentType extends Component>(
  instance: ECSInstance,
  entity: Entity,
  COMPONENT_TYPE_DEF: ComponentType,
) => {
  for (const keyToUpdate of lookupAssociatedComposedPoolKeys(
    instance,
    COMPONENT_TYPE_DEF,
  )) {
    if (instance.composedPools[keyToUpdate] && instance.composedPools[keyToUpdate][entity] !== undefined) {
      delete instance.composedPools[keyToUpdate][entity];
    }
  }

  if (instance.removeComponentCallback) {
    instance.removeComponentCallback(entity, COMPONENT_TYPE_DEF);
  }

  const entityComponents = instance.entities[entity];
  if (entityComponents) {
    delete entityComponents[COMPONENT_TYPE_DEF.type];
  }
};

export const queryComponents = <const ComposedType extends Component[]>(
  instance: ECSInstance,
  COMPONENT_TYPE_DEFS: ComposedType,
) => {
  const combination = COMPONENT_TYPE_DEFS.map(
    (COMPONENT_TYPE_DEF) => COMPONENT_TYPE_DEF.type,
  ).reduce((previous, current) => `${previous} ${current}`);

  if (instance.composedPools[combination] !== undefined) {
    return instance.composedPools[combination];
  }

  const poolComponents: Record<Entity, Component[]> = {};
  const componentTypes = COMPONENT_TYPE_DEFS.map(
    (COMPONENT_TYPE_DEF) => COMPONENT_TYPE_DEF.type,
  );

  for (const COMPONENT_TYPE_DEF of COMPONENT_TYPE_DEFS) {
    lookupAssociatedComposedPoolKeys(instance, COMPONENT_TYPE_DEF).push(
      combination,
    );
  }

  for (const [entityID, entityComponents] of Object.entries(instance.entities)) {
    const composedComponents: Component[] = [];

    for (const componentType of componentTypes) {
      const component = entityComponents[componentType];
      if (component === undefined) break;
      composedComponents.push(component);
    }

    if (composedComponents.length === componentTypes.length) {
      poolComponents[entityID] = composedComponents;
    }
  }

  instance.composedPools[combination] = poolComponents;
  return instance.composedPools[combination] as Record<string, ComposedType>;
};

export const runQuery = <const ComposedType extends Component[]>(
  instance: ECSInstance,
  COMPONENT_TYPE_DEFS: ComposedType,
  lambda: (entity: Entity, components: ComposedType) => void,
) => {
  for (const [entity, components] of Object.entries(
    queryComponents(instance, COMPONENT_TYPE_DEFS),
  )) {
    if (instance.componentProxyHandler) {
      const componentProxies = components.map((component) =>
        createComponentProxy(instance, entity, component),
      ) as ComposedType;
      lambda(entity, componentProxies);
    } else {
      lambda(entity, components as unknown as ComposedType);
    }
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

  createEntity: (name: string): Entity => createEntity(instance, name),
  destroyEntity: (entity: Entity) => destroyEntity(instance, entity),
  renameEntity: (oldEntity: Entity, newEntity: Entity): boolean =>
    renameEntity(instance, oldEntity, newEntity),

  addComponent: <ComponentType extends Component>(
    entity: Entity,
    COMPONENT_TYPE_DEF: ComponentType,
  ) => addComponent(instance, entity, COMPONENT_TYPE_DEF),
  removeComponent: <ComponentType extends Component>(
    entity: Entity,
    COMPONENT_TYPE_DEF: ComponentType,
  ) => removeComponent(instance, entity, COMPONENT_TYPE_DEF),

  getComponent: <ComponentType extends Component>(
    entity: Entity,
    COMPONENT_TYPE_DEF: ComponentType,
  ): ComponentType | undefined =>
    getComponent(instance, entity, COMPONENT_TYPE_DEF),
  getEntity: (entity: Entity): any =>
    getEntity(instance, entity),
  queryComponents: <const ComposedType extends Component[]>(
    COMPONENT_TYPE_DEFS: ComposedType,
  ) => queryComponents(instance, COMPONENT_TYPE_DEFS),

  runQuery: <const ComposedType extends Component[]>(
    COMPONENT_TYPE_DEFS: ComposedType,
    lambda: (entity: Entity, components: ComposedType) => void,
  ) => runQuery(instance, COMPONENT_TYPE_DEFS, lambda),

  selectEntity: (entity: Entity | null) => selectEntity(instance, entity),
  getSelectedEntity: (): Entity | null => getSelectedEntity(instance),
  clearSelection: () => clearSelection(instance),
});

export const provideECSInstanceFunctions = (
  ecsInstanceCreateInfo?: ECSInstanceCreateInfo,
) => {
  const ecsInstance = createECSInstance(ecsInstanceCreateInfo ?? {});

  return curryECSInstance(ecsInstance);
};
