import { cn } from "cnfast";
import { ChevronRight, PlusIcon, Trash2 } from "lucide-react";
import {
  Button,
  Collection,
  DropIndicator,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
} from "react-aria-components";

import { buildTree, removeParent, setParent } from "../parent";
import { isSerializableObject, type SerializableObject } from "../scene";
import { Dropdown } from "./Dropdown";
import { IconButton } from "./IconButton";
import AutoSizeInput from "./tree/AutoSizeInput";
import { reorderObjectKeys } from "./tree/objectHelpers";
import useScene from "./useScene";
import useSelectedObjects from "./useSelectedObjects";

function ObjectRow({
  node,
  onRename,
  onDelete,
}: {
  node: SerializableObject;
  onRename: (newKey: string) => void;
  onDelete: (key: string) => void;
}) {
  const { selectedObjects, selectObject, deselectObjects } = useSelectedObjects();

  const hasChildren = node.children.length > 0;
  const selected = selectedObjects.some(({ object }) => object === node.object);

  return (
    <TreeItem
      id={node.key}
      textValue={node.key}
      hasChildItems={hasChildren}
      className="flex flex-col"
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <div className="pl-[--spacing(calc((var(--tree-item-level)-1)*3))]">
            <div className={cn("group row", selected && "bg-select")}>
              <Button slot="drag" />

              <div
                className="flex-1"
                onClick={() => {
                  deselectObjects();
                  selectObject(node.key, node.object);
                }}
              >
                <AutoSizeInput
                  value={node.key}
                  onCommit={(value) => onRename(String(value))}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>

              <div
                className="flex items-center opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                {hasChildItems && (
                  <IconButton
                    icon={ChevronRight}
                    slot="chevron"
                    className={cn(isExpanded && "rotate-90")}
                  />
                )}

                <IconButton icon={Trash2} onClick={() => onDelete(node.key)} />
              </div>
            </div>
          </div>
        )}
      </TreeItemContent>

      <RowCollection nodes={node.children} onRename={onRename} onDelete={onDelete} />
    </TreeItem>
  );
}

function RowCollection({
  nodes,
  onRename,
  onDelete,
}: {
  nodes: SerializableObject[];
  onRename: (oldKey: string, newKey: string) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <Collection items={nodes}>
      {(node) => (
        <ObjectRow
          key={node.key}
          node={node}
          onRename={(newKey) => onRename(node.key, newKey)}
          onDelete={onDelete}
        />
      )}
    </Collection>
  );
}

export default function TopLevelObjects() {
  const scene = useScene();
  const { deselectObjects, selectObject } = useSelectedObjects();

  const roots = buildTree(scene);

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
          className={({ isDropTarget }) =>
            cn("h-0.5 bg-blue-500 rounded-full", isDropTarget && "opacity-100")
          }
        />
      );
    },

    onMove(event) {
      const targetKey = String(event.target.key);

      for (const key of event.keys) {
        const draggedKey = String(key);

        if (draggedKey === targetKey) continue;

        const dragged = scene[draggedKey];

        if (!isSerializableObject(dragged)) continue;

        if (event.target.dropPosition === "on") {
          setParent(dragged, targetKey);
          continue;
        }

        reorderObjectKeys(scene, draggedKey, targetKey, event.target.dropPosition);
      }
    },

    onRootDrop(event) {
      for (const item of event.items) {
        if (item.kind !== "text") continue;

        item.getText("text/plain").then((key) => {
          const dragged = scene[key];

          if (isSerializableObject(dragged)) {
            removeParent(dragged);
          }
        });
      }
    },
  });

  const renameObject = (oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey || scene[newKey]) return;

    deselectObjects();
    scene[newKey] = scene[oldKey];
    delete scene[oldKey];

    if (!isSerializableObject(scene[newKey])) return;
    selectObject(newKey, scene[newKey]);
  };

  const deleteObject = (key: string) => {
    delete scene[key];
    deselectObjects();
  };

  return (
    <Dropdown
      className="bg-background text-sm rounded-sm w-64 overflow-clip"
      buttonClassName="bg-foreground hover:bg-hover"
    >
      <div className="flex flex-col border-t border-border px-1 py-1.5">
        <button
          className="row items-center"
          onClick={() => {
            scene.newObject = {};
          }}
        >
          <PlusIcon className="icon-size" />
          New Object
        </button>

        <Tree aria-label="Scene Objects" dragAndDropHooks={dragAndDropHooks}>
          <RowCollection nodes={roots} onRename={renameObject} onDelete={deleteObject} />
        </Tree>
      </div>
    </Dropdown>
  );
}
