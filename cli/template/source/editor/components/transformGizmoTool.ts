export type TransformGizmoTool = "translate" | "rotate" | "scale";

const listeners = new Set<() => void>();

let activeTool: TransformGizmoTool = "translate";

export function getTransformGizmoTool(): TransformGizmoTool {
  return activeTool;
}

export function setTransformGizmoTool(next: TransformGizmoTool): void {
  if (activeTool === next) return;
  activeTool = next;
  listeners.forEach((l) => {
    l();
  });
}

export function subscribeTransformGizmoTool(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getTransformGizmoToolSnapshot(): TransformGizmoTool {
  return activeTool;
}
