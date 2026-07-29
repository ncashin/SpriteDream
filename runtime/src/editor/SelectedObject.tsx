import { Trash2, X } from "lucide-react";
import AddComponent from "./AddComponent";
import { IconButton } from "./IconButton";
import ObjectTree from "./ObjectRow";
import useScene from "./useScene";
import useSelectedObjects from "./useSelectedObjects";

export default function SelectedObject() {
  const scene = useScene();

  const { selectedObjects, deselectObject } = useSelectedObjects();
  const shownObject = selectedObjects.length > 0 ? selectedObjects[0] : undefined;

  if (!shownObject) return;
  const { key, object } = shownObject;

  return (
    <div className="flex flex-col w-96 text-sm rounded-sm overflow-clip bg-background">
      <div className="header bg-foreground">
        <h2 className="py-0.5">{String(key)}</h2>
        <div className="flex flex-row">
          <IconButton
            icon={Trash2}
            onClick={() => {
              deselectObject(object);
              delete scene[key];
            }}
          />
          <IconButton icon={X} onClick={() => deselectObject(object)} />
        </div>
      </div>

      <div className="border-t border-border overlay">
        <AddComponent object={object} />

        <ObjectTree object={object} />
      </div>
    </div>
  );
}
