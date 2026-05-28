import { useCallback, useEffect, useRef, useState } from "react";
import { GameIDEMode, getMode, setMode } from "../../lifecycle/mode.js";
import {
  fetchSceneList,
  isEmbeddedInParentFrame,
  requestHostSceneSave,
  requestHostSceneSwitch,
  subscribeToSceneEditorState,
  syncSceneQueryParam,
} from "./sceneFileBridge.js";

function confirmDiscardUnsaved(activeScenePath: string): boolean {
  return window.confirm(`Discard unsaved changes to ${activeScenePath}?`);
}

function formatSceneDocumentTitle(
  path: string,
  dirty: boolean,
  saving: boolean,
): string {
  if (saving) return "Saving…";
  if (dirty) return `* ${path}`;
  return path;
}

export function useSceneFile() {
  const [scenes, setScenes] = useState<string[]>([]);
  const [activeScenePath, setActiveScenePath] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const defaultDocumentTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "",
  );

  useEffect(() => {
    void fetchSceneList().then(setScenes);
  }, []);

  useEffect(() => {
    return subscribeToSceneEditorState((state) => {
      setActiveScenePath(state.path);
      setDirty(state.dirty);
      setSaving(state.saving);
      if (!isEmbeddedInParentFrame()) {
        syncSceneQueryParam(state.path);
      }
    });
  }, []);

  useEffect(() => {
    if (!activeScenePath) {
      document.title = defaultDocumentTitleRef.current;
      return;
    }

    document.title = formatSceneDocumentTitle(
      activeScenePath,
      dirty,
      saving,
    );
  }, [activeScenePath, dirty, saving]);

  const save = useCallback(() => {
    if (getMode() !== GameIDEMode.Editor) return;
    if (!dirty || saving) return;
    requestHostSceneSave();
  }, [dirty, saving]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") {
        return;
      }
      if (getMode() !== GameIDEMode.Editor) return;
      event.preventDefault();
      save();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const switchScene = useCallback(
    (relativePath: string) => {
      if (!relativePath || relativePath === activeScenePath) return;

      if (dirty && activeScenePath && !confirmDiscardUnsaved(activeScenePath)) {
        return;
      }

      if (getMode() === GameIDEMode.Game) {
        setMode(GameIDEMode.Editor);
      }

      requestHostSceneSwitch(relativePath);
    },
    [activeScenePath, dirty],
  );

  return {
    scenes,
    activeScenePath,
    switchScene,
    visible: scenes.length > 0,
  };
}
