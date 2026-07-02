import {
  defineTrait,
  gameModule,
  onDispose,
  type GameObject,
  type Scene,
} from "gameide";
import { z } from "zod";
import {
  composeWorldTransform,
  createDefaultTransformPose,
  deriveLocalTransform,
  readTransformPose,
  writeTransformPose,
} from "./transform.js";

export const sceneHierarchyTrait = defineTrait(
  "SceneHierarchy",
  z.object({
    __parent: z.string().default(""),
  }),
);

const scenesApplyingWorldTransform = new WeakSet<Scene>();

function getSceneObject(
  scene: Scene,
  key: PropertyKey,
): GameObject | undefined {
  const object = Reflect.get(scene.get(), key);
  return object && typeof object === "object" ? (object as GameObject) : undefined;
}

function findSceneObjectKey(
  scene: Scene,
  object: GameObject,
): PropertyKey | undefined {
  for (const key of Reflect.ownKeys(scene.getRaw())) {
    if (getSceneObject(scene, key) === object) return key;
  }
  return undefined;
}

function readParentKey(object: GameObject): PropertyKey | undefined {
  const parent = (object as { __parent?: unknown }).__parent;
  if (typeof parent !== "string" || parent.length === 0) return undefined;
  return parent;
}

function hasManagedTransform(object: GameObject): boolean {
  const transform = (object as { transform?: unknown }).transform;
  return !!transform && typeof transform === "object";
}

function getChildKeys(scene: Scene, parentKey: PropertyKey): PropertyKey[] {
  const keys: PropertyKey[] = [];
  for (const key of Reflect.ownKeys(scene.getRaw())) {
    const object = getSceneObject(scene, key);
    if (!object) continue;
    if (readParentKey(object) === parentKey) {
      keys.push(key);
    }
  }
  return keys;
}

function hasChildren(scene: Scene, key: PropertyKey): boolean {
  for (const candidateKey of Reflect.ownKeys(scene.getRaw())) {
    const object = getSceneObject(scene, candidateKey);
    if (!object) continue;
    if (readParentKey(object) === key) return true;
  }
  return false;
}

function resolveWorldTransform(
  scene: Scene,
  key: PropertyKey,
  visiting: Set<PropertyKey>,
): ReturnType<typeof createDefaultTransformPose> | null {
  if (visiting.has(key)) return null;
  const object = getSceneObject(scene, key);
  if (!object || !hasManagedTransform(object)) return null;

  visiting.add(key);
  const local = readTransformPose(object, "local");
  const parentKey = readParentKey(object);
  let world = local;

  if (parentKey !== undefined && parentKey !== key) {
    const parentWorld = resolveWorldTransform(scene, parentKey, visiting);
    if (parentWorld) {
      world = composeWorldTransform(parentWorld, local);
    }
  }

  writeTransformPose(object, "world", world);
  visiting.delete(key);
  return world;
}

function syncLocalFromWorld(scene: Scene, key: PropertyKey): boolean {
  const object = getSceneObject(scene, key);
  if (!object || !hasManagedTransform(object)) return false;

  return writeObjectLocalFromWorld(scene, key, object);
}

function writeObjectLocalFromWorld(
  scene: Scene,
  key: PropertyKey | undefined,
  object: GameObject,
): boolean {
  const parentKey = readParentKey(object);
  if (parentKey === undefined || parentKey === key) {
    return writeTransformPose(object, "local", readTransformPose(object, "world"));
  }

  const parent = getSceneObject(scene, parentKey);
  if (!parent || !hasManagedTransform(parent)) {
    return writeTransformPose(object, "local", readTransformPose(object, "world"));
  }

  const parentWorld =
    resolveWorldTransform(scene, parentKey, new Set()) ??
    readTransformPose(parent, "world");
  const world = readTransformPose(object, "world");
  return writeTransformPose(
    object,
    "local",
    deriveLocalTransform(parentWorld, world),
  );
}

export function writeSceneObjectWorldTransform(
  scene: Scene,
  object: GameObject,
  world: ReturnType<typeof createDefaultTransformPose>,
): void {
  const key = findSceneObjectKey(scene, object);
  scenesApplyingWorldTransform.add(scene);
  try {
    writeTransformPose(object, "world", world);
    writeObjectLocalFromWorld(scene, key, object);
    if (key !== undefined) {
      syncBranchWorldTransforms(scene, key, new Set());
    }
  } finally {
    scenesApplyingWorldTransform.delete(scene);
  }
}

function syncBranchWorldTransforms(
  scene: Scene,
  key: PropertyKey,
  visited: Set<PropertyKey>,
): void {
  if (visited.has(key)) return;
  visited.add(key);

  const world = resolveWorldTransform(scene, key, new Set());
  if (!world) return;

  for (const childKey of getChildKeys(scene, key)) {
    syncBranchWorldTransforms(scene, childKey, visited);
  }
}

function syncStandaloneObject(
  scene: Scene,
  key: PropertyKey,
  preferredSpace?: "local" | "world",
): boolean {
  const object = getSceneObject(scene, key);
  if (!object || !hasManagedTransform(object)) return false;
  const parentKey = readParentKey(object);
  if (parentKey !== undefined && parentKey !== key) return false;
  if (hasChildren(scene, key)) return false;

  if (preferredSpace === "world") {
    writeTransformPose(object, "local", readTransformPose(object, "world"));
    return true;
  }

  const local = readTransformPose(object, "local");
  writeTransformPose(object, "world", local);
  return true;
}

function isHierarchyRelevantMutation(path: PropertyKey[]): boolean {
  if (path.length === 0) return false;
  if (path.length === 1) return true;
  return path[1] === "__parent" || path[1] === "transform";
}

function changedTransformSpace(path: PropertyKey[]): "local" | "world" | null {
  if (path.length < 3) return null;
  if (path[1] !== "transform") return null;
  if (path[2] === "local") return "local";
  if (path[2] === "world") return "world";
  return null;
}

export const sceneHierarchyGameModule = gameModule(
  import.meta.url,
  <T extends { scene: Scene }>(context: T): T => {
    let isSyncing = false;

    function syncSceneRoot(sceneRootKey: PropertyKey, preferredSpace?: "local" | "world"): void {
      if (isSyncing) return;
      isSyncing = true;
      try {
        if (syncStandaloneObject(context.scene, sceneRootKey, preferredSpace)) {
          return;
        }
        if (preferredSpace === "world") {
          syncLocalFromWorld(context.scene, sceneRootKey);
        }
        syncBranchWorldTransforms(context.scene, sceneRootKey, new Set());
      } finally {
        isSyncing = false;
      }
    }

    for (const key of Reflect.ownKeys(context.scene.getRaw())) {
      syncSceneRoot(key);
    }

    const unsubscribe = context.scene.onChange((_object, path) => {
      if (scenesApplyingWorldTransform.has(context.scene)) return;
      if (!isHierarchyRelevantMutation(path)) return;
      const sceneRootKey = path[0];
      if (sceneRootKey === undefined) return;
      const preferredSpace =
        path[1] === "__parent" ? "world" : changedTransformSpace(path) ?? undefined;
      syncSceneRoot(sceneRootKey, preferredSpace);
    });
    onDispose(unsubscribe);

    return context;
  },
);
