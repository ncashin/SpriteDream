// TopLevelObjects.tsx

import { PlusIcon, Trash2 } from "lucide-react";
import { deselectObjects, selectObject } from "../selectedObject";
import { Dropdown } from "./Dropdown";
import { IconButton } from "./IconButton";
import { isObject } from "./SceneRow";
import useScene from "./useScene";

export default function TopLevelObjects() {
  const scene = useScene();

  return (
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
            <div key={key} className="group flex items-center hover:bg-hover">
              <button
                className="flex-1 text-left px-2 py-1"
                onClick={() => {
                  if (!isObject(value)) return;

                  deselectObjects();
                  selectObject(key, value);
                }}
              >
                {key}
              </button>

              <IconButton
                icon={Trash2}
                className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  delete scene[key];
                  deselectObjects();
                }}
              />
            </div>
          ))}
      </div>
    </Dropdown>
  );
}
