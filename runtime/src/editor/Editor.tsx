import { PlusIcon, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { setScene } from "../scene";
import { deselectObjects, selectObject, useSelectedObjects } from "../selectedObject";
import { Dropdown } from "./Dropdown";
import GameView from "./GameView";
import { IconButton } from "./IconButton";
import SceneRow, { isObject } from "./SceneRow";
import { SceneSelect } from "./SceneSelect";
import useDirectory from "./useDirectory";
import useEditorHotkeys from "./useEditorHotkeys";
import useFile from "./useFile";
import useScene from "./useScene";

export default function Editor() {
  const scene = useScene();

  const directoryQuery = useDirectory();
  const sceneFiles = useMemo(() => {
    return directoryQuery.data.filter((fileName) => fileName.endsWith(".scene"));
  }, [directoryQuery.data]);

  const [sceneFilepath, setSceneFilepath] = useState<string>(() => sceneFiles[0]);
  const deferredFilepath = useDeferredValue(sceneFilepath);

  const { fileQuery, writeMutation } = useFile(deferredFilepath, {
    onFileLoad: ({ data }) => {
      setScene(scene, data);
    },
  });

  const hasUnsavedChanges =
    !fileQuery.isPending && !(JSON.stringify(fileQuery.data) === JSON.stringify(scene));

  useEditorHotkeys({
    onSave: () => {
      writeMutation.mutate([JSON.stringify(scene)]);
    },
    onUndo: () => {},
    onRedo: () => {},

    hasUnsavedChanges,
  });

  const selectedObjects = useSelectedObjects();
  const shownObject = selectedObjects.length > 0 ? selectedObjects[0] : undefined;

  return (
    <>
      <div className="absolute inset-x-0 top-0 p-2 text-white pointer-events-none">
        <div className="relative flex items-start">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <Dropdown
              className="bg-background text-sm w-64 overflow-clip rounded-sm"
              buttonClassName="bg-foreground hover:bg-hover"
            >
              <div className="flex flex-col">
                <button
                  onClick={() => {
                    scene.newObject = {};
                  }}
                  className="flex flex-row py-1 pl-1.5 hover:bg-hover items-center border-t-2 border-b-2 border-border"
                >
                  <PlusIcon className="size-4" />
                  New Object
                </button>

                {Object.entries(scene)
                  .filter(isObject)
                  .map(([key, value]) => (
                    <button
                      className="flex flex-row justify-between items-center px-2 py-1 hover:bg-hover"
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
              <div className="flex flex-col bg-background w-96 text-sm overflow-clip rounded-sm">
                <div className="flex items-center px-2.5 py-1.5 bg-foreground">
                  <h2 className="font-semibold">{String(shownObject.key)}</h2>
                  <IconButton icon={X} onClick={deselectObjects} className="ml-auto" />
                </div>

                <div className="px-1 pt-1.5 pb-1.5 border-t-2 border-border">
                  <button
                    onClick={() => {
                      scene.newObject = {};
                    }}
                    className="flex flex-row w-full py-1 pl-1.5 hover:bg-hover items-center"
                  >
                    <PlusIcon className="size-4" />
                    Add to Object...
                  </button>

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

          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto">
            <SceneSelect
              deferredFilepath={deferredFilepath}
              sceneFiles={sceneFiles}
              setSceneFilepath={setSceneFilepath}
            />
          </div>
        </div>
      </div>

      <GameView />
    </>
  );
}
