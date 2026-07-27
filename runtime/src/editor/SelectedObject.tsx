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

      <div className="border-t border-border pt-2 pb-1.5 px-1">
        <AddComponent object={object} />

        {objectEntries.length > 0 && (
          <div className="">
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
