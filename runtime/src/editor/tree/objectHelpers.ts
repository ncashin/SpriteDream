import { isSerializableObject, type Serializable, type SerializableObject } from "../../scene";

export const reorderObjectKeys = (
  object: Record<string, unknown>,
  key: string,
  targetKey: string,
  position: "before" | "after",
) => {
  const entries = Object.entries(object);

  const from = entries.findIndex(([entryKey]) => entryKey === key);
  const to = entries.findIndex(([entryKey]) => entryKey === targetKey);

  if (from < 0 || to < 0) return;

  const [moved] = entries.splice(from, 1);

  const targetIndex = entries.findIndex(([entryKey]) => entryKey === targetKey);
  const insertAt = position === "after" ? targetIndex + 1 : targetIndex;

  entries.splice(insertAt, 0, moved);

  Object.keys(object).forEach((k) => delete object[k]);
  Object.assign(object, Object.fromEntries(entries));
};

export type Path = string;

export function getValue(root: SerializableObject, path: Path): Serializable | undefined {
  let current: Serializable = root;

  for (const part of path.split(".")) {
    if (!isSerializableObject(current)) return undefined;
    current = current[part];
  }

  return current;
}

export function getParent(root: SerializableObject, path: Path): SerializableObject | undefined {
  const parentPath = path.split(".").slice(0, -1).join(".");

  if (parentPath === "") return root;

  const parent = getValue(root, parentPath);
  return isSerializableObject(parent) ? parent : undefined;
}

export function getKey(path: Path): string {
  return path.split(".").at(-1)!;
}
