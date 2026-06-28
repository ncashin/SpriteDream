import { useSyncExternalStore } from "react";
import {
  getEditorDebugUIEnabled,
  onEditorDebugUIChange,
  toggleEditorDebugUI,
} from "../gameModules/editorGameModule/editorDebugUI.js";

export function useEditorDebugUI(): {
  enabled: boolean;
  toggle: () => void;
} {
  const enabled = useSyncExternalStore(
    onEditorDebugUIChange,
    getEditorDebugUIEnabled,
    getEditorDebugUIEnabled,
  );

  return { enabled, toggle: toggleEditorDebugUI };
}
