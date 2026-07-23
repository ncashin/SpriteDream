import { useHotkey, type HotkeyCallback } from "@tanstack/react-hotkeys";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { setScene } from "../scene";
import GameView from "./GameView";
import SceneRow from "./SceneRow";
import useDirectory from "./useDirectory";
import useFile from "./useFile";
import useScene from "./useScene";

export default function Editor() {
  const scene = useScene();

  const directoryQuery = useDirectory();
  const sceneFiles = useMemo(() => {
    return directoryQuery.data.filter((fileName) => fileName.endsWith(".scene"));
  }, [directoryQuery.data]);

  const [sceneFilepath, setSceneFilepath] = useState<string | undefined>(() =>
    sceneFiles.length > 0 ? sceneFiles[0] : undefined,
  );
  const [previousSceneFilepath, setPreviousSceneFilepath] = useState<string | undefined>(undefined);

  const deferredFilepath = useDeferredValue(sceneFilepath);

  const { fileQuery, writeMutation } = useFile(deferredFilepath);

  if (!fileQuery.isPending && deferredFilepath !== previousSceneFilepath) {
    setPreviousSceneFilepath(sceneFilepath);
    setScene(scene, fileQuery.data);
  }

  useHotkey("Mod+Z", (event) => {
    event.preventDefault();
  });

  useHotkey("Mod+Shift+Z", (event) => {
    event.preventDefault();
  });

  const stringifiedScene = JSON.stringify(scene);
  const unsavedChanges =
    !fileQuery.isPending && !(JSON.stringify(fileQuery.data) === stringifiedScene);

  const handleSave = useCallback<HotkeyCallback>(
    (event) => {
      event.preventDefault();
      if (!unsavedChanges) return;
      writeMutation.mutate([stringifiedScene]);
    },
    [writeMutation, stringifiedScene, unsavedChanges],
  );
  useHotkey("Mod+S", handleSave);

  useEffect(() => {
    if (!unsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [scene, unsavedChanges]);

  return (
    <div className="w-full h-full flex flex-row">
      <div className="h-full px-2  pt-2 border-r-2">
        <select
          className="p-0 m-0 box-border appearance-none px-1.5 py-0.5 hover:bg-slate-100"
          id="scene-file-select"
          value={deferredFilepath}
          onChange={(event) => {
            setSceneFilepath(event.target.value);
          }}
        >
          <option value="" disabled>
            Select a Scene
          </option>
          {sceneFiles &&
            sceneFiles.map((sceneFile) => (
              <option key={sceneFile} value={sceneFile}>
                {sceneFile}
              </option>
            ))}
        </select>

        {Object.entries(scene).map(([key, value]) => (
          <SceneRow
            key={key}
            entry={[key, value]}
            onKeyChange={(newKey) => {
              const existingValue = scene[key];
              delete scene[key];
              scene[newKey] = existingValue;
            }}
            onValueChange={(newValue) => {
              scene[key] = newValue;
            }}
          />
        ))}
      </div>
      <GameView />
    </div>
  );
}
