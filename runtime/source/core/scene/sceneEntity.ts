import type { Component, Entity, EntityComponents } from "../ecs/ecs";
import type { ContextExtension, RequirePlugin } from "../gameContext";
import { defineComponent, TransformComponentDefinition } from "../ecs/component";
import { addEditorStartCallback } from "../initialization";
import { ecsPlugin } from "./ecsAdapter";
import type { SceneData } from "./scene";
import { loadScene, loadSceneIfExists, type SceneName } from "./loadScene";

export type SceneEntityComponent = Component & {
    type: "sceneEntity";
    sceneName: string;
    rootEntity?: string;
};

export type SceneEntityRootComponent = Component & {
    type: "sceneEntityRoot";
    sceneName: string;
};

export const SceneEntityComponentDefinition: SceneEntityComponent = defineComponent(
    {
        type: "sceneEntity",
        sceneName: "",
        rootEntity: "",
    },
    {
        displayName: "Scene Entity",
        description: "Instantiate another scene as part of this scene",
        propertyInputTypes: {
            sceneName: {
                type: "text",
            },
        },
    }
);

export const SceneEntityRootComponentDefinition: SceneEntityRootComponent = defineComponent(
    {
        type: "sceneEntityRoot",
        sceneName: "",
    },
    {
        displayName: "Scene Entity Root",
        description: "Root entity created from a scene entity instance",
        propertyInputTypes: {
            sceneName: {
                type: "text",
            },
        },
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

    const rootName = entityIds.length === 1
        ? nameMap.get(entityIds[0])!
        : getUniqueEntityName(existingNames, options.rootName || "sceneRoot");

    if (entityIds.length > 1) {
        ecs.createEntity(rootName);
    }

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
                } else if (entityIds.length > 1 && (!parent || !nameMap.has(parent))) {
                    (cloned as { parent?: string | null }).parent = rootName;
                }
            }

            entityProxy[cloned.type] = cloned;
        }

        if (entityIds.length > 1 && !hasTransform) {
            ecs.setParent(newId, rootName);
        }
    }

    if (options.parentEntity) {
        ecs.setParent(rootName, options.parentEntity);
    }

    const rootEntityProxy = ecs.createEntity(rootName);
    if (!rootEntityProxy[SceneEntityRootComponentDefinition.type]) {
        rootEntityProxy[SceneEntityRootComponentDefinition.type] = {
            ...SceneEntityRootComponentDefinition,
            sceneName: typeof sceneDataOrName === "string" ? sceneDataOrName : "",
        };
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

export function sceneEntityPlugin<T extends RequirePlugin<[typeof ecsPlugin]>>(
    context: T
): ContextExtension<T, {
    ecs: T["ecs"] & {
        instantiateSceneEntity: CurriedInstantiateSceneEntity;
    };
    loadScene: typeof loadScene;
    instantiateSceneEntity: CurriedInstantiateSceneEntity;
}> {
    const ecsWithSceneEntity = context.ecs as T["ecs"] & {
        instantiateSceneEntity: CurriedInstantiateSceneEntity;
    };
    ecsWithSceneEntity.instantiateSceneEntity = (sceneDataOrName?, options?) =>
        instantiateSceneEntity(context.ecs, sceneDataOrName, options);

    addEditorStartCallback(() => {
        context.ecs.runQuery(
            [SceneEntityComponentDefinition],
            (entity, { sceneEntity }) => {
                const sceneName = sceneEntity.sceneName?.trim();
                if (!sceneName) return;

                const existingRoot = sceneEntity.rootEntity;
                if (existingRoot && context.ecs.ecsInstance.entities[existingRoot]) {
                    return;
                }

                const root = instantiateSceneEntityId(context.ecs, sceneName, {
                    rootName: sceneName,
                    parentEntity: entity,
                });
                if (root) {
                    sceneEntity.rootEntity = root;
                }
            }
        );
    });

    return {
        ...context,
        ecs: ecsWithSceneEntity,
        loadScene,
        instantiateSceneEntity: ecsWithSceneEntity.instantiateSceneEntity,
    };
}

