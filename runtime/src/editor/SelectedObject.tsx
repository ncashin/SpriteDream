// SelectedObject.tsx

import { PlusIcon, Trash2, X } from "lucide-react";
import { deselectObjects, useSelectedObjects } from "../selectedObject";
import { IconButton } from "./IconButton";
import SceneRow from "./SceneRow";
import useScene from "./useScene";

export default function SelectedObject() {
  const scene = useScene();

  const selectedObjects = useSelectedObjects();
  const shownObject = selectedObjects.length > 0 ? selectedObjects[0] : undefined;

  if (!shownObject) return;

  return (
    <div className="flex flex-col bg-background w-96 text-sm overflow-clip rounded-sm">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-foreground">
        <h2>{String(shownObject.key)}</h2>
        <div className="flex flex-row">
          <IconButton
            icon={Trash2}
            className="ml-auto"
            onClick={() => {
              delete scene[shownObject.key];
              deselectObjects();
            }}
          />
          <IconButton icon={X} onClick={deselectObjects} className="ml-auto" />
        </div>
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
              const existingValue = shownObject.object[key];
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
  );
}
