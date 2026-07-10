import GameView from "./GameView";
import useScene from "./useScene";
import { useMemo, useState } from "react";
import useFile from "./useFile";
import useFiles from "./useFileList";
import useSceneAPI from "./useSceneAPI";

function SceneRow({
  entry,
  onBlur,
}: {
  entry: [PropertyKey, unknown];
  onBlur: (arg0: string) => void;
}) {
  const [key, value] = entry;
  const [stringifiedKey, setStringifiedKey] = useState(String(key));
  return (
    <div className="flex flex-row">
      <input
        value={stringifiedKey}
        onChange={(event) => {
          setStringifiedKey(event.target.value);
        }}
        onBlur={() => {
          onBlur(stringifiedKey);
        }}
        style={{
          width: `${Math.max(stringifiedKey.length, 1)}ch`,
        }}
      />
      <span>:</span>

      {JSON.stringify(value)}
    </div>
  );
}

export default function Editor() {
  const files = useFiles();
  const sceneFiles = useMemo(
    () => files.filter((fileName) => fileName.endsWith(".scene")),
    [files],
  );

  const sceneAPI = useSceneAPI();
  const scene = useScene();

  const [sceneFilepath, setSceneFilepath] = useState<string | undefined>(
    undefined,
  );
  const [previousSceneFilepath, setPreviousSceneFilepath] =
    useState(sceneFilepath);

  const { file, isFilePending } = useFile(sceneFilepath);

  if (!isFilePending && sceneFilepath !== previousSceneFilepath) {
    setPreviousSceneFilepath(sceneFilepath);
    sceneAPI.replace(file);
  }

  const unsavedChanges = useMemo(() => {
    !isFilePending && file !== JSON.stringify(scene);
  }, [isFilePending, file, scene]);

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

        {Object.entries(scene).map(([key, value]) => (
          <SceneRow
            entry={[key, value]}
            onBlur={(newKey) => {
              const existingValue = scene[key];
              delete scene[key];
              scene[newKey] = existingValue;
            }}
          />
        ))}
      </div>
      <GameView />
    </div>
  );
}
