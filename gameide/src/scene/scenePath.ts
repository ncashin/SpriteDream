export type ScenePath = readonly PropertyKey[];

type SceneRecord = Record<PropertyKey, unknown>;

export function getValueAtPath(object: SceneRecord, path: ScenePath): unknown {
  let current: unknown = object;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as SceneRecord)[key];
  }
  return current;
}

export function setValueAtPathInObject(
  root: SceneRecord,
  path: ScenePath,
  value: unknown
): void {
  if (path.length === 0) return;
  let current: SceneRecord = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    let next = current[key];
    if (next === undefined || next === null || typeof next !== "object") {
      next = {};
      current[key] = next;
    }
    current = next as SceneRecord;
  }
  current[path[path.length - 1]] = value;
}

export function pathsEqual(firstPath: ScenePath, secondPath: ScenePath): boolean {
  if (firstPath.length !== secondPath.length) return false;
  return firstPath.every((key, index) => key === secondPath[index]);
}

export function isPathPrefixOf(prefixPath: ScenePath, path: ScenePath): boolean {
  if (prefixPath.length > path.length) return false;
  return prefixPath.every((key, index) => key === path[index]);
}

export function pathUpdateAffectsPath(
  changedPath: ScenePath,
  watchedPath: ScenePath
): boolean {
  return (
    pathsEqual(changedPath, watchedPath) ||
    isPathPrefixOf(changedPath, watchedPath) ||
    isPathPrefixOf(watchedPath, changedPath)
  );
}

export function pathsSharePrefix(firstPath: ScenePath, secondPath: ScenePath): boolean {
  return isPathPrefixOf(firstPath, secondPath) || isPathPrefixOf(secondPath, firstPath);
}

export function appendKeyToPath(path: ScenePath, key: PropertyKey): PropertyKey[] {
  return [...path, key];
}

export function getPathKey(path: ScenePath): string {
  return path.length === 0 ? "" : JSON.stringify(path);
}
