import GameView from "./GameView";
import useScene from "./useScene";
import { useMemo, useState } from "react";
import useFile from "./useFile";
import useFiles from "./useFileList";

export default function Editor() {
  const files = useFiles();
  const sceneFiles = useMemo(
    () => files.filter((fileName) => fileName.endsWith(".scene")),
    [files],
  );

  const scene = useScene();

  const [sceneFilepath, setSceneFilepath] = useState<string | undefined>(
    undefined,
  );
  const [previousSceneFilepath, setPreviousSceneFilepath] =
    useState(sceneFilepath);

  const { file, isFilePending } = useFile(sceneFilepath);

  if (!isFilePending && sceneFilepath !== previousSceneFilepath) {
    setPreviousSceneFilepath(sceneFilepath);
    scene.replace(file);
  }

  return (
    <div className="flex flex-row gap-32">
      <div>
        <select
          id="scene-file-select"
          value={sceneFilepath}
          onChange={(event) => {
            setSceneFilepath(event.target.value);
          }}
        >
          <option value="" disabled>
            Select a Scene
          </option>
          {sceneFiles.map((sceneFile) => (
            <option key={sceneFile} value={sceneFile}>
              {sceneFile}
            </option>
          ))}
        </select>

        {Object.entries(scene.object).map(([key, gameObject]) => (
          <div key={key} className="flex flex-row">
            <span>{key}:</span>
            {JSON.stringify(gameObject)}
          </div>
        ))}
      </div>
      <GameView />
    </div>
  );
}
