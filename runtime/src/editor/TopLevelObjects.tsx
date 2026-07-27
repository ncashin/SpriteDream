import { PlusIcon, Trash2 } from "lucide-react";
import { isSerializableObject } from "../scene";
import { Dropdown } from "./Dropdown";
import { IconButton } from "./IconButton";
import useScene from "./useScene";
import useSelectedObjects from "./useSelectedObjects";

export default function TopLevelObjects() {
  const scene = useScene();
  const { selectObject, deselectObjects } = useSelectedObjects();

  const sceneEntries = Object.entries(scene).filter(isSerializableObject);

  return (
    <Dropdown
      className="bg-background text-sm rounded-sm w-64 overflow-clip "
      buttonClassName="bg-foreground hover:bg-hover"
    >
      <div className="flex flex-col border-t border-border">
        <button
          onClick={() => {
            scene.newObject = {};
          }}
          className="row items-center"
        >
          <PlusIcon className="icon-size" />
          New Object
        </button>

        {sceneEntries.length > 0 && (
          <div className="border-t border-border">
            {sceneEntries.map(([key, value]) => (
              <div key={key} className="group flex flex-row items-center hover:bg-hover pr-1">
                <button
                  className="flex-1 text-left px-2 py-1"
                  onClick={() => {
                    if (!isSerializableObject(value)) return;

                    deselectObjects();
                    selectObject(key, value);
                  }}
                >
                  {key}
                </button>

                <IconButton
                  icon={Trash2}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    delete scene[key];
                    deselectObjects();
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Dropdown>
  );
}
