import { useDeferredValue, useMemo, useState } from "react";
import { setScene } from "../scene";
import GameView from "./GameView";
import { SceneSelect } from "./SceneSelect";
import SelectedObject from "./SelectedObject";
import TopLevelObjects from "./TopLevelObjects";
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

  const { confirmFileChange } = useEditorHotkeys({
    onSave: () => {
      writeMutation.mutate([JSON.stringify(scene)]);
    },
    onUndo: () => {},
    onRedo: () => {},

    hasUnsavedChanges,
  });

  return (
    <>
      <div className="absolute inset-x-0 top-0 p-2 text-white pointer-events-none">
        <div className="relative flex items-start">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <TopLevelObjects />
            <SelectedObject />
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto">
            <SceneSelect
              deferredFilepath={deferredFilepath}
              sceneFiles={sceneFiles}
              setSceneFilepath={setSceneFilepath}
              confirmFileChange={confirmFileChange}
            />
          </div>
        </div>
      </div>

      <GameView />
    </>
  );
}
