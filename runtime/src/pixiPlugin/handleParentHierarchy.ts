import { Container } from "pixi.js";

import { hasComponent } from "../tomove/components";
import type { GameContext } from "../tomove/gameide";
import { ParentComponent } from "../tomove/parent";
import { isSerializableObject, type SerializableObject } from "../tomove/scene";
import { TransformComponent } from "../tomove/transform";

const getParentKey = (
  object: SerializableObject,
  scene: SerializableObject,
): string | undefined => {
  if (!hasComponent(object, ParentComponent)) return undefined;

  const parentKey = object.parent;
  if (!parentKey || parentKey === "undefined") return undefined;
  if (!isSerializableObject(scene[parentKey])) return undefined;

  return parentKey;
};

export type ParentHierarchy = {
  getContainer: (key: string) => Container;
};

export const handleParentHierarchy = (
  gameContext: GameContext,
  root: Container,
): ParentHierarchy => {
  const { scene, onUpdate } = gameContext;
  const containerMap = new Map<string, Container>();

  const getContainer = (key: string) => {
    let container = containerMap.get(key);

    if (!container) {
      container = new Container();
      container.sortableChildren = true;
      containerMap.set(key, container);
    }

    return container;
  };

  const syncObject = (key: string, object: SerializableObject) => {
    const container = getContainer(key);
    const parentKey = getParentKey(object, scene);
    const pixiParent = parentKey ? getContainer(parentKey) : root;

    if (container.parent !== pixiParent) {
      pixiParent.addChild(container);
    }

    if (hasComponent(object, TransformComponent)) {
      const { position, rotation, scale } = object;

      container.position.set(-position.x, position.y);
      container.rotation = rotation.z ?? 0;
      container.scale.set(scale.x, scale.y);
    }
  };

  onUpdate(() => {
    const foundKeys = new Set<string>();

    for (const [key, value] of Object.entries(scene)) {
      if (!isSerializableObject(value)) continue;

      foundKeys.add(key);
      syncObject(key, value);
    }

    for (const [key, container] of containerMap) {
      if (foundKeys.has(key)) continue;
      if (container.children.length > 0) continue;

      container.parent?.removeChild(container);
      container.destroy({ children: false });
      containerMap.delete(key);
    }
  });

  return { getContainer };
};
