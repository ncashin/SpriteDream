import Box from "lucide/dist/esm/icons/box.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import Plus from "lucide/dist/esm/icons/plus.mjs";
import Trash from "lucide/dist/esm/icons/trash.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { isObject } from "../../utilities/is-object.ts";
import type { SceneNode } from "../../utilities/scene.ts";
import {
  deselectObject,
  selectObjects,
  selectedObjects,
} from "../../utilities/selected-objects.ts";
import { parentObject } from "../../utilities/viewport/transform.ts";
import { AutoSizeInput } from "./auto-size-input.tsx";
import { renameKey } from "./object-tree.tsx";
import {
  chevronOpen,
  childrenClip,
  childrenOpen,
  childrenPanel,
  expandable,
  iconButton,
  iconMotion,
  iconStack,
  indent,
  label,
  row,
} from "./tree.ts";

type HierarchyNode = {
  name: string;
  object: SceneNode;
  children: HierarchyNode[];
};

export const HierarchyTree = clientEntry(
  import.meta.url,
  function HierarchyTree(handle: Handle<{ object: SceneNode }>) {
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
      const root = handle.props.object;
      const nodes = hierarchy(root);

      return (
        <div>
          <button
            type="button"
            mix={[
              row,
              newObject,
              on("click", () => {
                const object = {};
                root[uniqueName(root, "object")] = object;
                selectObjects([object]);
                handle.update();
              }),
            ]}
          >
            <div mix={label}>
              <span mix={iconStack}>
                <Icon icon={Plus} size={14} />
              </span>
              New Object
            </div>
          </button>
          {nodes.map((node) => (
            <HierarchyBranch key={node.name} node={node} root={root} />
          ))}
        </div>
      );
    };
  },
);

function HierarchyBranch(handle: Handle<{ node: HierarchyNode; root: SceneNode }>) {
  let collapsed = false;
  let name = handle.props.node.name;

  return () => {
    const { object, children } = handle.props.node;
    const { root } = handle.props;
    const hasChildren = children.length > 0;

    const isSelected = selectedObjects.has(object);
    const open = !collapsed || isSelected;
    return (
      <>
        <div
          aria-current={isSelected ? "true" : undefined}
          aria-expanded={hasChildren ? open : undefined}
          mix={[
            row,
            hasChildren && expandable,
            on("click", (event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (target?.closest("button, input")) return;
              selectObjects([object]);
              if (isSelected && hasChildren) collapsed = !collapsed;
              handle.update();
            }),
          ]}
        >
          <div mix={label}>
            <span mix={[iconStack, iconMotion, hasChildren && open && chevronOpen]}>
              <Icon icon={Box} size={14} />
              {hasChildren && <Icon icon={ChevronRight} size={14} />}
            </span>
            <AutoSizeInput
              value={name}
              placeholder="object"
              label="Object"
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
        {hasChildren && (
          <div mix={[childrenPanel, open && childrenOpen]}>
            <div mix={[childrenClip, indent]}>
              {children.map((child) => (
                <HierarchyBranch key={child.name} node={child} root={root} />
              ))}
            </div>
          </div>
        )}
      </>
    );
  };
}

const newObject = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  "&:hover": {
    background: "#1e1e1e",
  },
  "&:focus-visible": {
    background: "#1e1e1e",
    outline: "1px solid currentColor",
    outlineOffset: "1px",
  },
});

function uniqueName(root: SceneNode, base: string) {
  let name = base;
  let n = 2;
  while (Object.hasOwn(root, name)) name = `${base}${n++}`;
  return name;
}

function renameNode(root: SceneNode, from: string, to: string) {
  renameKey(root, from, to);
  for (const value of Object.values(root)) {
    if (isObject(value) && value.parent === from) value.parent = to;
  }
}

function removeNode(node: HierarchyNode, root: SceneNode) {
  deselectObject(node.object);
  for (const child of node.children) removeNode(child, root);
  delete root[node.name];
}

function hierarchy(root: SceneNode): HierarchyNode[] {
  const items: { name: string; object: SceneNode }[] = [];
  for (const [name, value] of Object.entries(root)) {
    if (!isObject(value)) continue;
    items.push({ name, object: value });
  }

  const children = new Map<string, { name: string; object: SceneNode }[]>();
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

  function node(item: { name: string; object: SceneNode }): HierarchyNode {
    return {
      name: item.name,
      object: item.object,
      children: (children.get(item.name) ?? []).map(node),
    };
  }

  return roots.map(node);
}
