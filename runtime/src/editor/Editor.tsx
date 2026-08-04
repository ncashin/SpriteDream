import { PlayIcon, Settings, SquareStopIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { Mode } from "../createEditorStore";
import GameView from "./GameView";
import { SceneSelect } from "./SceneSelect";
import SelectedObject from "./SelectedObject";
import TopLevelObjects from "./TopLevelObjects";
import useDirectory from "./hooks/useDirectory";
import useEditorHotkeys from "./hooks/useEditorHotkeys";
import useFile from "./hooks/useFile";
import useMode from "./hooks/useMode";
import useScene from "./hooks/useScene";

export default function Editor() {
  const { scene, setScene } = useScene();
  const { mode, setMode } = useMode();

  const directoryQuery = useDirectory();
  const sceneFiles = useMemo(() => {
    return directoryQuery.data.filter((fileName) => fileName.endsWith(".scene"));
  }, [directoryQuery.data]);

  const [sceneFilepath, setSceneFilepath] = useState<string>(() => sceneFiles[0]);
  const deferredFilepath = useDeferredValue(sceneFilepath);

  const { fileQuery, writeMutation } = useFile(deferredFilepath, {
    onFileLoad: ({ data }) => {
      setScene(data);
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
      <div className="text-sm absolute inset-x-0 top-0 p-2 text-white pointer-events-none z-50">
        <div className="grid grid-cols-3 items-start">
          <div className="justify-self-start flex flex-col gap-4 pointer-events-auto">
            <TopLevelObjects />
            <SelectedObject />
          </div>

          <div className="justify-self-center pointer-events-auto">
            <SceneSelect
              deferredFilepath={deferredFilepath}
              sceneFiles={sceneFiles}
              setSceneFilepath={setSceneFilepath}
              confirmFileChange={confirmFileChange}
            />
          </div>

          <div className="justify-self-end flex flex-row gap-2 pointer-events-auto">
            <Button className="header gap-1  font-light">
              Settings <Settings className="icon-size" />
            </Button>

            {mode === Mode.Editor && (
              <Button className="header gap-1 font-light" onClick={() => setMode(Mode.Game)}>
                Run <PlayIcon className="icon-size" />
              </Button>
            )}

            {mode === Mode.Game && (
              <Button className="header gap-1 font-light" onClick={() => setMode(Mode.Editor)}>
                Stop <SquareStopIcon className="icon-size" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <GameView />
    </>
  );
}
