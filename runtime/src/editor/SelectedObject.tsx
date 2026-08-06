import { Trash2, X } from "lucide-react";
import { getValueAtPath } from "../tomove/objectHelpers";
import { isSerializableObject } from "../tomove/scene";
import AddComponent from "./AddComponent";
import useScene from "./hooks/useScene";
import useSelectedObjects from "./hooks/useSelectedObjects";
import { IconButton } from "./IconButton";
import ObjectTree from "./tree/ObjectTree";

export default function SelectedObject() {
  const { scene, setScene } = useScene();
  const { selectedObjects, deselectObject } = useSelectedObjects();

  const [key] = selectedObjects;
  if (!key) return;

  const object = getValueAtPath(scene, key);

  if (!isSerializableObject(object)) return null;

  return (
    <div className="flex flex-col w-96 text-sm overflow-clip bg-background">
      <div className="header bg-foreground">
        <h2 className="py-0.5">{String(key)}</h2>

        <div className="flex flex-row">
          <IconButton
            icon={Trash2}
            onClick={() => {
              const nextScene = structuredClone(scene);

              const parts = String(key).split(".");
              const objectKey = parts.pop()!;

              const parent = parts.length ? getValueAtPath(nextScene, parts.join(".")) : nextScene;

              if (isSerializableObject(parent)) {
                delete parent[objectKey];
              }

              deselectObject(key);
              setScene(nextScene);
            }}
          />

          <IconButton icon={X} onClick={() => deselectObject(key)} />
        </div>
      </div>

      <div className="border-t border-border overlay">
        <AddComponent object={object} />

        <ObjectTree
          object={object}
          setObject={(newObject) => {
            const nextScene = structuredClone(scene);

            const parts = String(key).split(".");
            const objectKey = parts.pop()!;

            const parent = parts.length ? getValueAtPath(nextScene, parts.join(".")) : nextScene;

            if (isSerializableObject(parent)) {
              parent[objectKey] = newObject;
            }

            setScene(nextScene);
          }}
        />
      </div>
    </div>
  );
}
