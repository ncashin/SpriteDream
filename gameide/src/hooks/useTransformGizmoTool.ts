import { useSyncExternalStore } from "react";
import {
  getTransformGizmoToolSnapshot,
  subscribeTransformGizmoTool,
} from "../plugins/editorPlugin/transformGizmoTool.js";
import type { TransformGizmoTool } from "../plugins/editorPlugin/transformGizmoTool.js";

export function useTransformGizmoTool(): TransformGizmoTool {
  return useSyncExternalStore(
    subscribeTransformGizmoTool,
    getTransformGizmoToolSnapshot,
    getTransformGizmoToolSnapshot,
  );
}
