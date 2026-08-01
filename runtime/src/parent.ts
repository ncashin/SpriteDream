import { z } from "zod";
import { defineComponent, hasComponent } from "./components";
import { isSerializableObject, type SerializableObject } from "./scene";

export const ParentComponent = defineComponent(
  "parent",
  z.object({
    parent: z.string(),
  }),
  {
    parent: "undefined",
  },
);

export const setParent = (child: SerializableObject, parent: string) => {
  child.parent = parent;
};
export const removeParent = (child: SerializableObject) => {
  delete child.parent;
};

type ObjectNode = {
  key: string;
  object: SerializableObject;
  children: ObjectNode[];
};

export const buildTree = (scene: SerializableObject) => {
  const roots: ObjectNode[] = [];

  return (
    Object.entries(scene).reduce<Record<string, ObjectNode>>((hierarchy, [key, object]) => {
      if (!isSerializableObject(object)) return hierarchy;

      const node = hierarchy[key] ?? {
        key,
        object,
        children: [],
      };

      hierarchy[key] = node;

      if (hasComponent(object, ParentComponent) && object.parent) {
        const parent = hierarchy[object.parent] ?? {
          key: object.parent,
          object: scene[object.parent],
          children: [],
        };

        hierarchy[object.parent] = parent;
        parent.children.push(node);
      } else {
        roots.push(node);
      }

      return hierarchy;
    }, {}) && roots
  );
};
