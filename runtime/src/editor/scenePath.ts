export function setAtPath(
  scene: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  if (parts.length === 0) return;
  let current: Record<string, unknown> = scene;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    let next = current[key];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      next = {};
      current[key] = next;
    }
    current = next as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
