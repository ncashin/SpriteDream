import { useHotkey, type HotkeyCallback } from "@tanstack/react-hotkeys";
import { useCallback, useMemo, useState } from "react";
import GameView from "./GameView";
import useDirectory from "./useDirectory";
import useFile from "./useFile";
import useScene from "./useScene";

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
  const scene = useScene();

  const [sceneFilepath, setSceneFilepath] = useState<string | undefined>(undefined);
  const [previousSceneFilepath, setPreviousSceneFilepath] = useState(sceneFilepath);

  const directoryQuery = useDirectory();
  const sceneFiles = useMemo(() => {
    console.log(directoryQuery.data);
    if (directoryQuery.isPending || !directoryQuery.data) return [];

    const sceneFiles = directoryQuery.data.filter((fileName) => fileName.endsWith(".scene"));

    if (!sceneFilepath && sceneFiles.length > 0) setSceneFilepath(sceneFiles[0]);
  }, [sceneFilepath, directoryQuery.data, directoryQuery.isPending]);

  const { fileQuery, writeMutation } = useFile(sceneFilepath);

  if (!fileQuery.isPending && sceneFilepath !== previousSceneFilepath) {
    setPreviousSceneFilepath(sceneFilepath);
    scene.replace(fileQuery.data);
  }

  const handleSave = useCallback<HotkeyCallback>(
    (event) => {
      const stringifiedScene = JSON.stringify(scene);

      const unsavedChanges = !fileQuery.isPending && fileQuery.data !== JSON.stringify(scene);

      event.preventDefault();
      if (unsavedChanges) {
        writeMutation.mutate([stringifiedScene]);
      }
    },
    [scene, writeMutation, fileQuery.data, fileQuery.isPending],
  );
  useHotkey("Mod+S", handleSave);

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
