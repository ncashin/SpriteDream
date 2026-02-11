import type { Component, Entity, EntityComponents } from "../ecs/ecs";
import type { ContextExtension, RequirePlugin } from "../gameContext";
import { defineComponent, TransformComponentDefinition } from "../ecs/component";
import { addEditorStartCallback } from "../initialization";
import { getChildren } from "../transform";
import { ecsPlugin } from "./ecsAdapter";
import type { SceneData } from "./scene";
import { loadScene, loadSceneIfExists, availableSceneNames, type SceneName } from "./loadScene";

export type SceneEntityComponent = Component & {
    type: "sceneEntity";
    sceneName: string;
};

export type SceneEntityRootComponent = Component & {
    type: "sceneEntityRoot";
};

export const SceneEntityComponentDefinition: SceneEntityComponent = defineComponent(
    {
        type: "sceneEntity",
        sceneName: "",
    },
    {
        displayName: "Scene Entity",
        description: "Instantiate another scene as part of this scene",
        propertyInputTypes: {
            sceneName: {
                type: "dropdown",
                options: availableSceneNames,
            },
        },
    }
);

export const SceneEntityRootComponentDefinition: SceneEntityRootComponent = defineComponent(
    {
        type: "sceneEntityRoot",
    },
    {
        displayName: "Scene Entity Root",
        description: "Root entity created from a scene entity instance",
    }
);

type InstantiateOptions = {
    rootName?: string;
    parentEntity?: Entity | null;
};

type CurriedInstantiateSceneEntity = (
    sceneDataOrName?: SceneData | SceneName | string,
    options?: InstantiateOptions
) => Record<string, Component> | null;

function resolveSceneData(sceneDataOrName?: SceneData | string): SceneData | null {
    if (!sceneDataOrName) {
        return null;
    }
    if (typeof sceneDataOrName !== "string") {
        return sceneDataOrName;
    }

    const dataToParse = loadSceneIfExists(sceneDataOrName) ?? sceneDataOrName;

    try {
        return JSON.parse(dataToParse);
    } catch {
        return null;
    }
}

function getSceneEntities(sceneData: SceneData): Record<Entity, EntityComponents> | null {
    if (!sceneData || typeof sceneData !== "object") return null;
    const ecsData = (sceneData as { ecs?: unknown }).ecs;
    if (!ecsData || typeof ecsData !== "object") return null;
    const entities = (ecsData as { entities?: unknown }).entities;
    if (!entities || typeof entities !== "object" || Array.isArray(entities)) return null;
    return entities as Record<Entity, EntityComponents>;
}

function getUniqueEntityName(existing: Set<string>, baseName: string): string {
    let name = baseName || "entity";
    let counter = 1;
    while (existing.has(name)) {
        name = `${baseName || "entity"}_${counter}`;
        counter += 1;
    }
    existing.add(name);
    return name;
}

function instantiateSceneEntityId(
    ecs: ReturnType<typeof ecsPlugin>["ecs"],
    sceneDataOrName?: SceneData | SceneName | string,
    options: InstantiateOptions = {}
): Entity | null {
    const sceneData = resolveSceneData(sceneDataOrName);
    if (!sceneData) return null;

    const sceneEntities = getSceneEntities(sceneData);
    if (!sceneEntities) return null;

    const entityIds = Object.keys(sceneEntities);
    if (entityIds.length === 0) return null;

    const existingNames = new Set(Object.keys(ecs.ecsInstance.entities));
    const nameMap = new Map<string, string>();

    for (const id of entityIds) {
        nameMap.set(id, getUniqueEntityName(existingNames, id));
    }

    const parentEntity = options.parentEntity;
    const useParentAsRoot = parentEntity != null;

    const rootName = entityIds.length === 1
        ? nameMap.get(entityIds[0])!
        : getUniqueEntityName(existingNames, options.rootName || "sceneRoot");

    if (entityIds.length > 1 && !useParentAsRoot) {
        const rootProxy = ecs.createEntity(rootName);
        delete rootProxy[TransformComponentDefinition.type];
        rootProxy[SceneEntityRootComponentDefinition.type] = {
            ...SceneEntityRootComponentDefinition,
        };
    }

    const effectiveRoot = useParentAsRoot ? parentEntity : rootName;

    for (const id of entityIds) {
        const newId = nameMap.get(id)!;
        const entityProxy = ecs.createEntity(newId);
        const components = sceneEntities[id];

        let hasTransform = false;

        for (const component of Object.values(components)) {
            if (!component || typeof component !== "object" || !("type" in component)) {
                continue;
            }

            const cloned = structuredClone(component) as Component;
            if (cloned.type === TransformComponentDefinition.type) {
                hasTransform = true;
                const parent = (cloned as { parent?: string | null }).parent;
                if (parent && nameMap.has(parent)) {
                    (cloned as { parent?: string | null }).parent = nameMap.get(parent);
                } else if (entityIds.length > 1 && !useParentAsRoot && (!parent || !nameMap.has(parent))) {
                    (cloned as { parent?: string | null }).parent = rootName;
                } else if (useParentAsRoot && (!parent || !nameMap.has(parent))) {
                    (cloned as { parent?: string | null }).parent = parentEntity!;
                }
            }

            entityProxy[cloned.type] = cloned;
        }

        if (entityIds.length > 1 && !hasTransform) {
            ecs.setParent(newId, effectiveRoot);
        }
    }

    if (parentEntity && !useParentAsRoot) {
        ecs.setParent(rootName, parentEntity);
    }

    if (useParentAsRoot) {
        for (const id of entityIds) {
            const newId = nameMap.get(id)!;
            const childProxy = ecs.createEntity(newId);
            if (!childProxy[SceneEntityRootComponentDefinition.type]) {
                childProxy[SceneEntityRootComponentDefinition.type] = {
                    ...SceneEntityRootComponentDefinition,
                };
            }
        }
    } else {
        const rootEntityProxy = ecs.createEntity(rootName);
        if (!rootEntityProxy[SceneEntityRootComponentDefinition.type]) {
            rootEntityProxy[SceneEntityRootComponentDefinition.type] = {
                ...SceneEntityRootComponentDefinition,
            };
        }
    }


    if (useParentAsRoot) {
        return entityIds.length === 1 ? nameMap.get(entityIds[0])! : parentEntity!;
    }
    return rootName;
}

export function instantiateSceneEntity(
    ecs: ReturnType<typeof ecsPlugin>["ecs"],
    sceneDataOrName?: SceneData | SceneName | string,
    options: InstantiateOptions = {}
): Record<string, Component> | null {
    const rootName = instantiateSceneEntityId(ecs, sceneDataOrName, options);
    if (!rootName) return null;
    return ecs.getEntity(rootName);
}

function tryInstantiateSceneEntity(
    ecs: ReturnType<typeof ecsPlugin>["ecs"],
    entity: Entity,
    sceneEntity: SceneEntityComponent
): void {
    const sceneName = sceneEntity.sceneName?.trim();
    if (!sceneName) return;

    const children = getChildren(ecs.ecsInstance, entity);
    const alreadyInstantiated = children.some(
        (childId) => ecs.ecsInstance.entities[childId]?.sceneEntityRoot
    );
    if (alreadyInstantiated) return;

    instantiateSceneEntityId(ecs, sceneName, {
        rootName: sceneName,
        parentEntity: entity,
    });
}

export function sceneEntityPlugin<T extends RequirePlugin<[typeof ecsPlugin]>>(
    context: T
): ContextExtension<T, {
    ecs: T["ecs"] & {
        instantiateSceneEntity: CurriedInstantiateSceneEntity;
    };
    loadScene: typeof loadScene;
    instantiateSceneEntity: CurriedInstantiateSceneEntity;
}> {
    const ecs = context.ecs;
    const ecsWithSceneEntity = ecs as T["ecs"] & {
        instantiateSceneEntity: CurriedInstantiateSceneEntity;
    };
    ecsWithSceneEntity.instantiateSceneEntity = (sceneDataOrName?, options?) =>
        instantiateSceneEntity(ecs, sceneDataOrName, options);

    addEditorStartCallback(() => {
        ecs.runQuery([SceneEntityComponentDefinition], (entity, { sceneEntity }) => {
            tryInstantiateSceneEntity(ecs, entity, sceneEntity);
        });
    });

    const instance = ecs.ecsInstance;
    const originalAddComponent = instance.addComponentCallback;
    instance.addComponentCallback = (entity, component) => {
        originalAddComponent?.(entity, component);
        if (component.type === SceneEntityComponentDefinition.type) {
            tryInstantiateSceneEntity(ecs, entity, component as SceneEntityComponent);
        }
    };

    const originalProxyHandler = instance.componentProxyHandler;
    if (originalProxyHandler) {
        instance.componentProxyHandler = {
            set: (entity, component, property, newValue) => {
                const result = originalProxyHandler.set(entity, component, property, newValue);
                if (
                    result &&
                    component.type === SceneEntityComponentDefinition.type &&
                    property === "sceneName"
                ) {
                    tryInstantiateSceneEntity(ecs, entity, component as SceneEntityComponent);
                }
                return result;
            },
        };
    }

    return {
        ...context,
        ecs: ecsWithSceneEntity,
        loadScene,
        instantiateSceneEntity: ecsWithSceneEntity.instantiateSceneEntity,
    };
}

