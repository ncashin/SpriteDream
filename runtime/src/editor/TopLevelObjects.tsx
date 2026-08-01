import cn from "cnfast";
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
import { reorderObjectKeys } from "./reorderHelper";
import useScene from "./useScene";
import useSelectedObjects from "./useSelectedObjects";

function ObjectRow({
  node,
  onDelete,
}: {
  node: SerializableObject;
  onDelete: (key: string) => void;
}) {
  const { selectedObjects, selectObject, deselectObjects } = useSelectedObjects();

  const hasChildren = node.children.length > 0;

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
            <div
              className={cn(
                "group row",
                selectedObjects.some(({ object }) => object === node.object) && "bg-select",
              )}
            >
              <Button slot="drag" />
              <Button
                className="flex-1 flex items-center text-left"
                onClick={() => {
                  deselectObjects();
                  selectObject(node.key, node.object);
                }}
              >
                {node.key}
              </Button>

              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {hasChildItems && (
                  <IconButton
                    icon={ChevronRight}
                    slot="chevron"
                    className={cn(isExpanded && "rotate-90")}
                  />
                )}
                <IconButton
                  icon={Trash2}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onDelete(node.key)}
                />
              </div>
            </div>
          </div>
        )}
      </TreeItemContent>

      <Collection items={node.children}>
        {(child) => <ObjectRow key={child.key} node={child} onDelete={onDelete} />}
      </Collection>
    </TreeItem>
  );
}

export default function TopLevelObjects() {
  const scene = useScene();
  const { deselectObjects } = useSelectedObjects();

  const roots = buildTree(scene);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems(keys) {
      return [...keys].map((key) => ({
        "text/plain": String(key),
      }));
    },

    renderDragPreview(items) {
      return (
        <div className="drag-preview">
          {items[0]["text/plain"]}
          <span className="badge">{items.length}</span>
        </div>
      );
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
    async onItemDrop(event) {
      const targetKey = String(event.target.key);

      for (const item of event.items) {
        if (item.kind !== "text") continue;
        const draggedKey = await item.getText("text/plain");

        if (!draggedKey || draggedKey === targetKey) continue;

        const dragged = scene[draggedKey];

        if (!isSerializableObject(dragged)) continue;

        setParent(dragged, targetKey);
      }
    },

    async onInsert(event) {
      for (const item of event.items) {
        if (item.kind !== "text") continue;

        const draggedKey = await item.getText("text/plain");

        if (!draggedKey) continue;

        const dragged = scene[draggedKey];

        if (!isSerializableObject(dragged)) continue;

        delete dragged.parent;
      }
    },
    async onMove(event) {
      const targetKey = String(event.target.key);

      for (const key of event.keys) {
        const draggedKey = String(key);

        if (draggedKey === targetKey) continue;

        const dragged = scene[draggedKey];

        if (!isSerializableObject(dragged)) continue;

        if (event.target.dropPosition !== "on") {
          const reordered = reorderObjectKeys(
            scene,
            draggedKey,
            targetKey,
            event.target.dropPosition,
          );

          Object.keys(scene).forEach((key) => delete scene[key]);
          Object.assign(scene, reordered);

          return;
        }

        setParent(dragged, targetKey);
      }
    },

    async onRootDrop(event) {
      for (const item of event.items) {
        if (item.kind !== "text") continue;

        const draggedKey = await item.getText("text/plain");

        if (!draggedKey) continue;

        const dragged = scene[draggedKey];

        if (!isSerializableObject(dragged)) continue;

        removeParent(dragged);
      }
    },
  });

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
          <Collection items={roots}>
            {(node) => (
              <ObjectRow
                key={node.key}
                node={node}
                onDelete={(key) => {
                  delete scene[key];
                  deselectObjects();
                }}
              />
            )}
          </Collection>
        </Tree>
      </div>
    </Dropdown>
  );
}
