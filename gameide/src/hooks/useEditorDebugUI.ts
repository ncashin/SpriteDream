import { useSyncExternalStore } from "react";
import {
  getEditorDebugUIEnabled,
  onEditorDebugUIChange,
  toggleEditorDebugUI,
} from "../plugins/editorPlugin/editorDebugUI.js";

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
