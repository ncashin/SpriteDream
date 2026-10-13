import Box from "lucide/dist/esm/icons/box.mjs";
import ChevronDown from "lucide/dist/esm/icons/chevron-down.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import Trash from "lucide/dist/esm/icons/trash.mjs";
import { clientEntry, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { isObject } from "../../utilities/is-object.ts";
import {
  deselectObject,
  selectObjects,
  selectedObjects,
} from "../../utilities/selected-objects.ts";
import { parentObject } from "../../utilities/viewport/transform.ts";
import { AutoSizeInput } from "./auto-size-input.tsx";
import { renameKey, type GameObject } from "./object-tree.tsx";
import { expandable, iconButton, iconStack, indent, label, row } from "./tree.ts";

type HierarchyNode = {
  name: string;
  object: GameObject;
  children: HierarchyNode[];
};

export const HierarchyTree = clientEntry(
  import.meta.url,
  function HierarchyTree(handle: Handle<{ object: GameObject }>) {
    if (typeof requestAnimationFrame === "function") {
      let frame = requestAnimationFrame(function tick() {
        if (handle.signal.aborted) return;
        handle.update();
        frame = requestAnimationFrame(tick);
      });
      handle.signal.addEventListener("abort", () =>
        cancelAnimationFrame(frame),
      );
    }

    return () => {
      const nodes = hierarchy(handle.props.object);
      if (nodes.length === 0) return null;

      return (
        <div>
          {nodes.map((node) => (
            <HierarchyBranch key={node.name} node={node} root={handle.props.object} />
          ))}
        </div>
      );
    };
  },
);

function HierarchyBranch(handle: Handle<{ node: HierarchyNode; root: GameObject }>) {
  let collapsed = false;
  let name = handle.props.node.name;

  return () => {
    const { object, children } = handle.props.node;
    const { root } = handle.props;
    const hasChildren = children.length > 0;

    const isSelected = selectedObjects.has(object);
    return (
      <>
        <div aria-current={isSelected ? "true" : undefined} mix={row}>
          <div
            aria-expanded={hasChildren ? !collapsed : undefined}
            mix={[
              label,
              hasChildren && expandable,
              on("click", () => {
                selectObjects([object]);
                if (isSelected && hasChildren) {
                  collapsed = !collapsed;
                }
                handle.update();
              }),
            ]}
          >
            <span mix={iconStack}>
              <Icon icon={Box} size={14} />
              {hasChildren && (
                <Icon icon={collapsed ? ChevronRight : ChevronDown} size={14} />
              )}
            </span>
            <AutoSizeInput
              value={name}
              placeholder="name"
              label="Name"
              onPointerDown={() => {
                selectObjects([object]);
                handle.update();
              }}
              onCommit={(next) => {
                if (Object.hasOwn(root, next)) return false;
                renameNode(root, name, next);
                handle.update();
              }}
            />
          </div>
          <button
            type="button"
            aria-label={`Delete ${name}`}
            mix={[
              iconButton,
              on("click", (event) => {
                event.stopPropagation();
                removeNode(handle.props.node, root);
                handle.update();
              }),
            ]}
          >
            <Icon icon={Trash} size={14} />
          </button>
        </div>
        {hasChildren && !collapsed && (
          <div mix={indent}>
            {children.map((child) => (
              <HierarchyBranch key={child.name} node={child} root={root} />
            ))}
          </div>
        )}
      </>
    );
  };
}

function renameNode(root: GameObject, from: string, to: string) {
  renameKey(root, from, to);
  for (const value of Object.values(root)) {
    if (isObject(value) && !(value instanceof DOMMatrix) && value.parent === from) value.parent = to;
  }
}

function removeNode(node: HierarchyNode, root: GameObject) {
  deselectObject(node.object);
  for (const child of node.children) removeNode(child, root);
  delete root[node.name];
}

function hierarchy(root: GameObject): HierarchyNode[] {
  const items: { name: string; object: GameObject }[] = [];
  for (const [name, value] of Object.entries(root)) {
    if (!isObject(value) || value instanceof DOMMatrix) continue;
    items.push({ name, object: value });
  }

  const children = new Map<string, { name: string; object: GameObject }[]>();
  const childNames = new Set<string>();

  for (const item of items) {
    const parent = parentObject(item.object, root);
    const parentItem = parent
      ? items.find((entry) => entry.object === parent)
      : undefined;
    if (!parentItem) continue;
    const list = children.get(parentItem.name) ?? [];
    list.push(item);
    children.set(parentItem.name, list);
    childNames.add(item.name);
  }

  const roots = items.filter((item) => !childNames.has(item.name));

  function node(item: { name: string; object: GameObject }): HierarchyNode {
    return {
      name: item.name,
      object: item.object,
      children: (children.get(item.name) ?? []).map(node),
    };
  }

  return roots.map(node);
}
