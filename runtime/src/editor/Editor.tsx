import { PlayIcon, Settings } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "react-aria-components";
import { setScene } from "../scene";
import GameView from "./GameView";
import { SceneSelect } from "./SceneSelect";
import SelectedObject from "./SelectedObject";
import TopLevelObjects from "./TopLevelObjects";
import useDirectory from "./useDirectory";
import useEditorHotkeys from "./useEditorHotkeys";
import useFile from "./useFile";
import useGameContext from "./useGameContext";
import useScene from "./useScene";

export default function Editor() {
  const scene = useScene();

  const gameContext = useGameContext();

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
      <div className="text-sm absolute inset-x-0 top-0 p-2 text-white pointer-events-none z-50">
        <div className="grid grid-cols-3 items-start">
          {/* Left */}
          <div className="justify-self-start flex flex-col gap-4 pointer-events-auto">
            <TopLevelObjects />
            <SelectedObject />
          </div>

          {/* Center */}
          <div className="justify-self-center pointer-events-auto">
            <SceneSelect
              deferredFilepath={deferredFilepath}
              sceneFiles={sceneFiles}
              setSceneFilepath={setSceneFilepath}
              confirmFileChange={confirmFileChange}
            />
          </div>

          {/* Right */}
          <div className="justify-self-end flex flex-row gap-2 pointer-events-auto">
            <Button className="header gap-1">
              Settings <Settings className="icon-size" />
            </Button>

            <Button
              className="header gap-1"
              onClick={() => {
                gameContext.__run.rerunAfter({ ...gameContext, isEditor: false });
              }}
            >
              Run <PlayIcon className="icon-size" />
            </Button>
          </div>
        </div>
      </div>

      <GameView />
    </>
  );
}
