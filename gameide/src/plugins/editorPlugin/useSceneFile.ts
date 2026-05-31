import { useCallback, useEffect, useRef } from "react";
import { GameIDEMode, getMode, setMode } from "../../lifecycle/mode.js";
import { useSceneFileStore } from "../../scene/sceneFileStore.js";

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
  const activeScenePath = useSceneFileStore((state) => state.activeScenePath);
  const scenes = useSceneFileStore((state) => state.scenes);
  const dirty = useSceneFileStore((state) => state.dirty);
  const saving = useSceneFileStore((state) => state.saving);
  const setActiveScenePath = useSceneFileStore(
    (state) => state.setActiveScenePath,
  );
  const loadScenes = useSceneFileStore((state) => state.loadScenes);
  const requestSave = useSceneFileStore((state) => state.requestSave);
  const defaultDocumentTitleRef = useRef(
    typeof document !== "undefined" ? document.title : "",
  );

  useEffect(() => {
    void loadScenes();
  }, [loadScenes]);

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
    requestSave();
  }, [dirty, requestSave, saving]);

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

      setActiveScenePath(relativePath);
    },
    [activeScenePath, dirty, setActiveScenePath],
  );

  return {
    scenes,
    activeScenePath,
    switchScene,
  };
}
