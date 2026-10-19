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
import { parentObject, setObjectParent } from "../../utilities/viewport/transform.ts";
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
  let wasSelected = false;
  let name = handle.props.node.name;

  return () => {
    const { object, children } = handle.props.node;
    const { root } = handle.props;
    const hasChildren = children.length > 0;

    const isSelected = selectedObjects.has(object);
    if (isSelected && !wasSelected && collapsed) collapsed = false;
    wasSelected = isSelected;
    const open = !collapsed || forcedOpen.has(name);
    const position = dropTarget?.name === name ? dropTarget.position : undefined;
    return (
      <>
        <div
          data-hierarchy-node={name}
          aria-current={isSelected ? "true" : undefined}
          aria-expanded={hasChildren ? open : undefined}
          mix={[
            row,
            hasChildren && expandable,
            dragSource?.object === object && dragging,
            position === "before" && dropBefore,
            position === "inside" && dropInside,
            position === "after" && dropAfter,
            on("pointerdown", (event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (event.button !== 0 || target?.closest("button, input")) return;
              trackDrag(event, name, object, root);
            }),
            on("click", (event) => {
              if (suppressClick) {
                suppressClick = false;
                return;
              }
              const target = event.target instanceof Element ? event.target : null;
              if (target?.closest("button, input")) return;
              selectObjects([object]);
              if (isSelected && hasChildren) {
                collapsed = !collapsed;
                if (collapsed) forcedOpen.delete(name);
              }
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
            <Icon icon={Trash} size={11} />
            Delete
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

type DropPosition = "before" | "inside" | "after";

let dragSource: { name: string; object: SceneNode } | null = null;
let dropTarget: { name: string; position: DropPosition } | null = null;
let suppressClick = false;
const forcedOpen = new Set<string>();

function trackDrag(event: PointerEvent, name: string, object: SceneNode, root: SceneNode) {
  const pointerId = event.pointerId;
  const originX = event.clientX;
  const originY = event.clientY;
  let active = false;

  const move = (next: PointerEvent) => {
    if (next.pointerId !== pointerId) return;
    if (!active) {
      if (Math.hypot(next.clientX - originX, next.clientY - originY) < 4) return;
      active = true;
      suppressClick = true;
      dragSource = { name, object };
      selectObjects([object]);
    }
    dropTarget = dropAt(next.clientX, next.clientY, name, root);
  };

  const finish = (next: PointerEvent) => {
    if (next.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    if (active && dropTarget) moveNode(root, name, object, dropTarget);
    dragSource = null;
    dropTarget = null;
    if (active) setTimeout(() => {
      suppressClick = false;
    }, 0);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
}

function dropAt(
  x: number,
  y: number,
  sourceName: string,
  root: SceneNode,
): { name: string; position: DropPosition } | null {
  const hit = document.elementFromPoint(x, y);
  const row = hit instanceof Element ? hit.closest("[data-hierarchy-node]") : null;
  const name = row?.getAttribute("data-hierarchy-node");
  if (!name || name === sourceName || !(row instanceof HTMLElement)) return null;
  const target = root[name];
  if (!isObject(target)) return null;
  const rect = row.getBoundingClientRect();
  const ratio = rect.height === 0 ? 0.5 : (y - rect.top) / rect.height;
  const position: DropPosition = ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
  const parent = position === "inside" ? name : parentNameOf(target, root);
  if (parent && createsCycle(sourceName, parent, root)) return null;
  return { name, position };
}

function moveNode(
  root: SceneNode,
  name: string,
  object: SceneNode,
  target: { name: string; position: DropPosition },
) {
  const destination = root[target.name];
  if (!isObject(destination) || destination === object) return;
  const parent = target.position === "inside" ? target.name : parentNameOf(destination, root);
  if (parent && createsCycle(name, parent, root)) return;
  setObjectParent(object, parent);
  if (target.position === "inside") forcedOpen.add(target.name);
  if (target.position === "before") placeKey(root, name, target.name);
  else placeKey(root, name, undefined, target.position === "after" ? target.name : lastChildKey(root, target.name));
}

function parentNameOf(object: SceneNode, root: SceneNode) {
  const parent = parentObject(object, root);
  if (!parent) return;
  return Object.entries(root).find(([, value]) => value === parent)?.[0];
}

function createsCycle(name: string, parent: string, root: SceneNode) {
  const seen = new Set<string>();
  let current: string | undefined = parent;
  while (current && !seen.has(current)) {
    if (current === name) return true;
    seen.add(current);
    const value: unknown = root[current];
    current = isObject(value) ? parentNameOf(value, root) : undefined;
  }
  return false;
}

function lastChildKey(root: SceneNode, parent: string) {
  let last = parent;
  for (const [key, value] of Object.entries(root)) {
    if (!isObject(value)) continue;
    if (parentNameOf(value, root) === parent) last = key;
  }
  return last;
}

function placeKey(root: SceneNode, name: string, before?: string, after?: string) {
  const value = root[name];
  const entries = Object.entries(root).filter(([key]) => key !== name);
  let index = entries.length;
  if (before) {
    const found = entries.findIndex(([key]) => key === before);
    if (found >= 0) index = found;
  } else if (after) {
    const found = entries.findIndex(([key]) => key === after);
    if (found >= 0) index = found + 1;
  }
  entries.splice(index, 0, [name, value]);
  for (const key of Object.keys(root)) delete root[key];
  for (const [key, entry] of entries) root[key] = entry;
}

const dragging = css({
  opacity: 0.45,
});

const dropLine = {
  content: '""',
  position: "absolute",
  left: "0.375rem",
  right: "0.25rem",
  height: "2px",
  background: "currentColor",
  borderRadius: "1px",
  pointerEvents: "none",
} as const;

const dropBefore = css({
  position: "relative",
  "&::before": {
    ...dropLine,
    top: 0,
  },
});

const dropInside = css({
  background: "var(--hover)",
  "&[aria-current='true']": {
    background: "var(--hover)",
  },
});

const dropAfter = css({
  position: "relative",
  "&::after": {
    ...dropLine,
    bottom: 0,
  },
});

const newObject = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  "&:hover": {
    background: "var(--hover)",
  },
  "&:focus-visible": {
    background: "var(--hover)",
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
