import { useHotkey, type HotkeyCallback } from "@tanstack/react-hotkeys";
import { Box, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { setScene } from "../scene";
import { deselectObjects, selectObject, useSelectedObjects } from "../selectedObject";
import { Dropdown } from "./Dropdown";
import GameView from "./GameView";
import SceneRow, { isObject } from "./SceneRow";
import { SceneSelect } from "./SceneSelect";
import useDirectory from "./useDirectory";
import useFile from "./useFile";
import useScene from "./useScene";

export default function Editor() {
  const scene = useScene();

  const directoryQuery = useDirectory();
  const sceneFiles = useMemo(() => {
    return directoryQuery.data.filter((fileName) => fileName.endsWith(".scene"));
  }, [directoryQuery.data]);

  const [sceneFilepath, setSceneFilepath] = useState<string>(() => sceneFiles[0]);
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

  const selectedObjects = useSelectedObjects();

  const shownObject = selectedObjects[0];
  return (
    <>
      <div className="absolute p-2 w-full flex flex-row justify-between items-center text-white">
        <div className="flex flex-col gap-4">
          <Dropdown
            className="bg-background text-sm w-64 overflow-clip"
            buttonClassName="bg-foreground hover:bg-hover "
          >
            <div className="flex flex-col border-t-2 border-border">
              {Object.entries(scene)
                .filter(isObject)
                .map(([key, value]) => (
                  <button
                    className=" flex flex-row justify-between items-center px-2 py-1  hover:bg-hover "
                    onClick={() => {
                      if (!isObject(value)) return;
                      deselectObjects();
                      selectObject(key, value);
                    }}
                    key={key}
                  >
                    {key}
                  </button>
                ))}
            </div>
          </Dropdown>
          {shownObject && (
            <div className="flex flex-col bg-background rounded-md w-96 overflow-clip text-sm">
              <div className="flex items-center px-2.5 py-1.5 bg-foreground">
                <Box className="size-4" />
                <h2 className="ml-2 font-semibold">{shownObject.key}</h2>
                <X className="ml-auto size-4 cursor-pointer" onClick={() => deselectObjects()} />
              </div>
              <div className="px-1 pt-2.5 pb-1.5 border-t-2 border-border">
                {Object.entries(shownObject.object).map(([key, value]) => (
                  <SceneRow
                    key={key}
                    parent={scene}
                    entry={[key, value]}
                    onKeyChange={(newKey) => {
                      const existingValue = scene[key];
                      delete shownObject.object[key];
                      shownObject.object[newKey] = existingValue;
                    }}
                    onValueChange={(newValue) => {
                      shownObject.object[key] = newValue;
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <SceneSelect
          deferredFilepath={deferredFilepath}
          sceneFiles={sceneFiles}
          setSceneFilepath={setSceneFilepath}
        />
      </div>
      <GameView />
    </>
  );
}
