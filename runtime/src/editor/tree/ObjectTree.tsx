import { cn } from "cnfast";
import { Box, ChevronRight, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Button,
  Collection,
  DropIndicator,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
} from "react-aria-components";

import {
  isSerializableObject,
  type Serializable,
  type SerializableObject,
} from "../../tomove/scene";

import { getParent, getValueAtPath, reorderObjectKeys } from "../../tomove/objectHelpers";
import { IconButton } from "../IconButton";
import AutoSizeInput from "./AutoSizeInput";

export default function ObjectTree({
  object,
  setObject,
}: {
  object: SerializableObject;
  setObject: (object: SerializableObject) => void;
}) {
  const { dragAndDropHooks } = useDragAndDrop({
    getItems(keys) {
      return [...keys].map((key) => ({
        "text/plain": String(key),
      }));
    },

    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className={({ isDropTarget }) => cn("h-0.5 bg-blue-500", isDropTarget && "opacity-100")}
        />
      );
    },

    async onMove(event) {
      const next = structuredClone(object);

      const targetPath = String(event.target.key);

      for (const key of event.keys) {
        const draggedPath = String(key);

        if (draggedPath === targetPath) continue;

        const draggedParent = getParent(next, draggedPath);
        const targetParent = getParent(next, targetPath);

        const draggedKey = draggedPath.split(".").pop()!;
        const targetKey = targetPath.split(".").pop()!;

        if (!draggedParent || !targetParent) continue;

        // Drop inside object
        if (event.target.dropPosition === "on") {
          const targetObject = getValueAtPath(next, targetPath);

          if (!isSerializableObject(targetObject)) continue;

          targetObject[draggedKey] = draggedParent[draggedKey];

          delete draggedParent[draggedKey];

          break;
        }

        // Same parent reorder
        if (draggedParent === targetParent) {
          reorderObjectKeys(
            draggedParent,
            draggedKey,
            targetKey,
            event.target.dropPosition === "after" ? "after" : "before",
          );

          break;
        }

        // Move between parents
        const value = draggedParent[draggedKey];

        delete draggedParent[draggedKey];

        targetParent[draggedKey] = value;

        reorderObjectKeys(
          targetParent,
          draggedKey,
          targetKey,
          event.target.dropPosition === "after" ? "after" : "before",
        );

        break;
      }

      setObject(next);
    },
  });

  return (
    <Tree aria-label="Object Viewer" dragAndDropHooks={dragAndDropHooks}>
      <RowCollection path="" object={object} setObject={setObject} />
    </Tree>
  );
}

function RowCollection({
  path,
  object,
  setObject,
}: {
  path: string;
  object: SerializableObject;
  setObject: (object: SerializableObject) => void;
}) {
  return (
    <Collection items={Object.entries(object)}>
      {([key, value]) => {
        const childPath = path ? `${path}.${key}` : key;

        return (
          <ObjectRow
            key={childPath}
            path={childPath}
            object={object}
            setObject={setObject}
            entry={[key, value]}
          />
        );
      }}
    </Collection>
  );
}

function ObjectRow({
  path,
  object,
  setObject,
  entry,
}: {
  path: string;
  object: SerializableObject;
  setObject: (object: SerializableObject) => void;
  entry: [string, Serializable];
}) {
  const [key, value] = entry;

  const children = isSerializableObject(value) ? Object.entries(value) : [];

  return (
    <TreeItem
      id={path}
      textValue={key}
      hasChildItems={children.length > 0}
      className="flex flex-col"
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <div className="group pl-[--spacing(calc((var(--tree-item-level)-1)*3))]">
            <div className="row flex flex-row items-center">
              <Button slot="drag" className="absolute w-0 h-0 p-0 m-0 opacity-0 pointer-events-none" tabIndex={-1} aria-hidden />
         
         
              <div className={cn(hasChildItems && "flex-1 flex flex-row gap-1 items-center")}>
                {hasChildItems && <Box className="icon-size " />}

                <AutoSizeInput
                  value={key}
                  onCommit={(newKey) => {
                    const next = structuredClone(object);

                    const newKeyString = String(newKey);

                    next[newKeyString] = next[key];

                    delete next[key];

                    setObject(next);
                  }}
                />

                {!hasChildItems && <span className="w-min">:</span>}
              </div>

              {!isSerializableObject(value) && (
                <AutoSizeInput
                  className="flex-1 text-emerald-200"
                  value={String(value)}
                  onCommit={(newValue) => {
                    const next = structuredClone(object);

                    next[key] = newValue;

                    setObject(next);
                  }}
                />
              )}

              <div
                className="flex flex-row items-center opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                {hasChildItems && (
                  <IconButton
                    icon={ChevronRight}
                    slot="chevron"
                    className={cn(isExpanded && "rotate-90")}
                  />
                )}

                {isSerializableObject(value) && (
                  <IconButton
                    icon={PlusIcon}
                    onClick={() => {
                      const next = structuredClone(object);

                      const child = next[key];

                      if (!isSerializableObject(child)) return;

                      child.newKey = "";

                      setObject(next);
                    }}
                  />
                )}

                <IconButton
                  icon={Trash2Icon}
                  onClick={() => {
                    const next = structuredClone(object);

                    delete next[key];

                    setObject(next);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </TreeItemContent>

      {isSerializableObject(value) && (
        <RowCollection
          path={path}
          object={value}
          setObject={(child) => {
            const next = structuredClone(object);

            next[key] = child;

            setObject(next);
          }}
        />
      )}
    </TreeItem>
  );
}
