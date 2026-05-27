import { useCallback, useEffect, useRef, useState } from "react";
import { getRawScene, getScene } from "../../scene/scene.js";
import {
  fetchSceneList,
  initialScenePathFromUrl,
  isEmbeddedInParentFrame,
  requestHostSceneSave,
  requestHostSceneSwitch,
  saveSceneToDevServer,
  sceneSnapshot,
  subscribeToSceneEditorState,
  switchSceneInDevServer,
} from "./sceneFileBridge.js";

function confirmDiscardUnsaved(activeScenePath: string): boolean {
  return window.confirm(`Discard unsaved changes to ${activeScenePath}?`);
}

export function useSceneFile() {
  const embedded = isEmbeddedInParentFrame();
  const [scenes, setScenes] = useState<string[]>([]);
  const [activeScenePath, setActiveScenePath] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hostControlled, setHostControlled] = useState(false);
  const savedSnapshotRef = useRef("");
  const devInitializedRef = useRef(false);

  const devServerMode = !embedded && !hostControlled;

  useEffect(() => {
    void fetchSceneList().then(setScenes);
  }, []);

  useEffect(() => {
    if (!embedded) return;
    return subscribeToSceneEditorState((state) => {
      setHostControlled(true);
      setActiveScenePath(state.path);
      setDirty(state.dirty);
      setSaving(state.saving);
    });
  }, [embedded]);

  useEffect(() => {
    if (!devServerMode || scenes.length === 0 || devInitializedRef.current) {
      return;
    }

    devInitializedRef.current = true;
    const initial = initialScenePathFromUrl(scenes);
    if (!initial) return;

    void switchSceneInDevServer(initial)
      .then((data) => {
        savedSnapshotRef.current = sceneSnapshot(data);
        setActiveScenePath(initial);
        setDirty(false);
      })
      .catch((err) => {
        console.error("[gameide] initial scene load failed:", err);
        devInitializedRef.current = false;
      });
  }, [devServerMode, scenes]);

  useEffect(() => {
    if (!devServerMode) return;
    return getScene().onChange(() => {
      if (!activeScenePath) return;
      setDirty(sceneSnapshot(getRawScene()) !== savedSnapshotRef.current);
    });
  }, [activeScenePath, devServerMode]);

  const save = useCallback(async () => {
    if (hostControlled) {
      if (!dirty || saving) return;
      requestHostSceneSave();
      return;
    }

    if (!devServerMode || !activeScenePath || !dirty || saving) return;

    setSaving(true);
    try {
      const data = getRawScene();
      await saveSceneToDevServer(activeScenePath, data);
      savedSnapshotRef.current = sceneSnapshot(data);
      setDirty(false);
    } catch (err) {
      console.error("[gameide] scene save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [activeScenePath, devServerMode, dirty, hostControlled, saving]);

  useEffect(() => {
    if (!hostControlled && !devServerMode) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") {
        return;
      }
      event.preventDefault();
      void save();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [devServerMode, hostControlled, save]);

  const switchScene = useCallback(
    async (relativePath: string) => {
      if (!relativePath || relativePath === activeScenePath) return;

      if (hostControlled) {
        requestHostSceneSwitch(relativePath);
        return;
      }

      if (!devServerMode) return;

      if (dirty && activeScenePath && !confirmDiscardUnsaved(activeScenePath)) {
        return;
      }

      try {
        const data = await switchSceneInDevServer(relativePath);
        savedSnapshotRef.current = sceneSnapshot(data);
        setActiveScenePath(relativePath);
        setDirty(false);
      } catch (err) {
        console.error("[gameide] scene load failed:", err);
      }
    },
    [activeScenePath, devServerMode, dirty, hostControlled],
  );

  const visible = hostControlled || (devServerMode && scenes.length > 0);

  return {
    scenes,
    activeScenePath,
    switchScene,
    visible,
  };
}
