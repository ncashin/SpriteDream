import { Trash2, X } from "lucide-react";
import AddComponent from "./AddComponent";
import { IconButton } from "./IconButton";
import ObjectRow from "./ObjectRow";
import useScene from "./useScene";
import useSelectedObjects from "./useSelectedObjects";

export default function SelectedObject() {
  const scene = useScene();

  const { selectedObjects, deselectObject } = useSelectedObjects();
  const shownObject = selectedObjects.length > 0 ? selectedObjects[0] : undefined;

  if (!shownObject) return;
  const { key, object } = shownObject;

  const objectEntries = Object.entries(object);

  return (
    <div className="flex flex-col bg-background w-96 text-sm overflow-clip rounded-sm">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-foreground">
        <h2>{String(key)}</h2>
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

      <div className="border-t-2 border-border">
        <AddComponent object={object} />

        {objectEntries.length > 0 && (
          <div className="border-t-2 border-border">
            {objectEntries.map(([childKey, childValue]) => (
              <ObjectRow
                key={childKey}
                parent={object}
                entry={[childKey, childValue]}
                onKeyChange={(newKey) => {
                  const existingValue = shownObject.object[childKey];
                  delete shownObject.object[childKey];
                  shownObject.object[newKey] = existingValue;
                }}
                onValueChange={(newValue) => {
                  shownObject.object[childKey] = newValue;
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
