import { useHotkey, type HotkeyCallback } from "@tanstack/react-hotkeys";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import GameView from "./GameView";
import useDirectory from "./useDirectory";
import useFile from "./useFile";
import useScene from "./useScene";

function SceneRow({
  entry,
  onKeyChange,
  onValueChange,
}: {
  entry: [PropertyKey, unknown];
  onKeyChange: (arg0: string) => void;
  onValueChange: (arg0: string) => void;
}) {
  const [key, value] = entry;
  const [stringifiedKey, setStringifiedKey] = useState(String(key));
  const [stringifiedValue, setStringifiedValue] = useState(String(key));

  const isObject = !!value && typeof value === "object";

  return (
    <div className="flex flex-col pb-2">
      <div className="flex flex-row">
        <input
          value={stringifiedKey}
          onChange={(event) => {
            setStringifiedKey(event.target.value);
          }}
          onBlur={() => {
            onKeyChange(stringifiedKey);
          }}
          style={{
            width: `${Math.max(stringifiedKey.length, 1)}ch`,
          }}
        />
        <span>:</span>
        {!isObject && (
          <input
            value={stringifiedValue}
            onChange={(event) => {
              setStringifiedValue(event.target.value);
            }}
            onBlur={() => {
              onValueChange(stringifiedKey);
            }}
            style={{
              width: `${Math.max(stringifiedValue.length, 1)}ch`,
            }}
          />
        )}
      </div>
      <div className="pl-2">
        {isObject &&
          typeof value === "object" &&
          Object.entries(value).map(([key, value]) => (
            <SceneRow
              key={key}
              entry={[key, value]}
              onKeyChange={(newKey) => {
                const existingValue = value[key];
                delete value[key];
                value[newKey] = existingValue;
              }}
              onValueChange={(newValue) => {
                value[key] = newValue;
              }}
            />
          ))}
      </div>
    </div>
  );
}

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
    scene.replace(fileQuery.data);
  }

  const stringifiedScene = JSON.stringify(scene);
  const unsavedChanges = !fileQuery.isPending && fileQuery.data !== JSON.stringify(scene);
  const handleSave = useCallback<HotkeyCallback>(
    (event) => {
      event.preventDefault();
      if (unsavedChanges) {
        writeMutation.mutate([stringifiedScene]);
      }
    },
    [writeMutation, unsavedChanges, stringifiedScene],
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
  }, [unsavedChanges]);

  return (
    <div className="flex flex-row gap-32">
      <div>
        <select
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
