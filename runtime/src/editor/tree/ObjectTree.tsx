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

import { isSerializableObject, type Serializable, type SerializableObject } from "../../scene";

import { IconButton } from "../IconButton";
import AutoSizeInput from "./AutoSizeInput";
import { getParent, getValue, reorderObjectKeys } from "./objectHelpers";

export function ObjectRow({
  id,
  parent,
  entry,
  onKeyChange,
  onValueChange,
}: {
  id: string;
  parent: SerializableObject;
  entry: [string, Serializable];
  onKeyChange: (arg0: Serializable) => void;
  onValueChange: (arg0: Serializable) => void;
}) {
  const [key, value] = entry;

  const entries = isSerializableObject(value) ? Object.entries(value) : [];
  const canBeExpanded = entries.length > 0;

  return (
    <TreeItem id={id} textValue={key} hasChildItems={canBeExpanded} className="flex flex-col">
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <div className="group pl-[--spacing(calc((var(--tree-item-level)-1)*3))]">
            <div className="row">
              <Button slot="drag" />
              <div className={cn(hasChildItems && "flex-1 flex flex-row items-center")}>
                {hasChildItems && <Box className="icon-size mr-1" />}

                <AutoSizeInput value={key} onCommit={onKeyChange} />

                {!hasChildItems && <span className="w-min">:</span>}
              </div>

              {!isSerializableObject(value) && (
                <AutoSizeInput
                  className="flex-1 text-emerald-200"
                  value={String(value)}
                  onCommit={onValueChange}
                />
              )}

              <div
                className="flex flex-row items-center opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                {canBeExpanded && (
                  <IconButton
                    icon={ChevronRight}
                    slot="chevron"
                    className={cn(isExpanded && "rotate-90")}
                  />
                )}

                {isSerializableObject(value) && <IconButton icon={PlusIcon} onClick={() => {}} />}

                <IconButton
                  icon={Trash2Icon}
                  onClick={() => {
                    delete parent[key];
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </TreeItemContent>

      <RowCollection id={id} parent={value} entries={entries} />
    </TreeItem>
  );
}

export function RowCollection({
  id,
  parent,
  entries,
}: {
  id?: string;
  parent: Serializable;
  entries: [string, Serializable][];
}) {
  if (!isSerializableObject(parent)) return;
  return (
    <Collection items={entries}>
      {([childKey, childValue]) => {
        const idChild = !id ? childKey : `${id}.${childKey}`;

        return (
          <ObjectRow
            key={childKey}
            id={idChild}
            parent={parent}
            entry={[childKey, childValue]}
            onKeyChange={(newKey) => {
              const keyString = String(newKey);
              const existingValue = parent[childKey];

              delete parent[childKey];
              parent[keyString] = existingValue;
            }}
            onValueChange={(newValue) => {
              parent[childKey] = newValue;
            }}
          />
        );
      }}
    </Collection>
  );
}

export default function ObjectTree({ object }: { object: SerializableObject }) {
  const entries = Object.entries(object);

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
      const targetPath = String(event.target.key);

      for (const key of event.keys) {
        const draggedPath = String(key);

        if (draggedPath === targetPath) continue;

        const draggedParent = getParent(object, draggedPath);
        const targetParent = getParent(object, targetPath);

        const draggedKey = draggedPath.split(".").pop()!;
        const targetKey = targetPath.split(".").pop()!;

        if (!draggedParent || !targetParent) continue;

        // Move into object
        if (event.target.dropPosition === "on") {
          const targetObject = getValue(object, targetPath);

          if (!isSerializableObject(targetObject)) continue;

          targetObject[draggedKey] = draggedParent[draggedKey];
          delete draggedParent[draggedKey];

          return;
        }

        // Same parent just reorder
        if (draggedParent === targetParent) {
          reorderObjectKeys(
            draggedParent,
            draggedKey,
            targetKey,
            event.target.dropPosition === "after" ? "after" : "before",
          );

          return;
        }

        // Different parent remove and insert into new parent
        const value = draggedParent[draggedKey];

        delete draggedParent[draggedKey];

        targetParent[draggedKey] = value;

        reorderObjectKeys(
          targetParent,
          draggedKey,
          targetKey,
          event.target.dropPosition === "after" ? "after" : "before",
        );

        return;
      }
    },
  });

  return (
    <Tree aria-label="Selected Object Viewer" dragAndDropHooks={dragAndDropHooks}>
      <RowCollection parent={object} entries={entries} />
    </Tree>
  );
}
