import Box from "lucide/dist/esm/icons/box.mjs";
import ChevronDown from "lucide/dist/esm/icons/chevron-down.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import Locate from "lucide/dist/esm/icons/locate.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { center } from "../../utilities/bounding.ts";
import { isObject } from "../../utilities/is-object.ts";
import { selectObjects, selectedObjects } from "../../utilities/selected-objects.ts";
import { parentObject, transform } from "../../utilities/viewport/transform.ts";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";
import { centerOn } from "../../utilities/viewport/viewport.ts";
import type { GameObject } from "./object-tree.tsx";

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
      handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
    }

    return () => {
      const nodes = hierarchy(handle.props.object);
      if (nodes.length === 0) return null;

      return (
        <div>
          {nodes.map((node) => (
            <HierarchyBranch key={node.name} node={node} />
          ))}
        </div>
      );
    };
  },
);

function HierarchyBranch(handle: Handle<{ node: HierarchyNode }>) {
  let collapsed = false;

  return () => {
    const { name, object, children } = handle.props.node;
    const target = jumpTarget(object);
    const hasChildren = children.length > 0;

    return (
      <>
        <div aria-current={selectedObjects.has(object) ? "true" : undefined} mix={row}>
          <div
            aria-expanded={hasChildren ? !collapsed : undefined}
            mix={[
              label,
              hasChildren ? expandable : null,
              on("click", () => {
                selectObjects([object]);
                if (hasChildren) collapsed = !collapsed;
                handle.update();
              }),
            ]}
          >
            <span
              mix={css({
                display: "grid",
                "& > *": { gridArea: "1 / 1" },
              })}
            >
              <Icon icon={Box} size={14} />
              {hasChildren ? <Icon icon={collapsed ? ChevronRight : ChevronDown} size={14} /> : null}
            </span>
            {name}
          </div>
          {target ? (
            <button
              type="button"
              aria-label={`Jump to ${name}`}
              mix={[
                iconButton,
                on("click", (event) => {
                  event.stopPropagation();
                  const point = jumpTarget(object);
                  if (!point) return;
                  selectObjects([object]);
                  centerOn(point);
                }),
              ]}
            >
              <Icon icon={Locate} size={14} />
            </button>
          ) : null}
        </div>
        {hasChildren && !collapsed ? (
          <div mix={css({ paddingLeft: "0.75rem" })}>
            {children.map((child) => (
              <HierarchyBranch key={child.name} node={child} />
            ))}
          </div>
        ) : null}
      </>
    );
  };
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
    const parentItem = parent ? items.find((entry) => entry.object === parent) : undefined;
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

function jumpTarget(object: GameObject): WorldPoint | undefined {
  const own = pointOf(object);
  if (own) return own;

  const points: WorldPoint[] = [];
  for (const value of Object.values(object)) {
    if (isObject(value) && !(value instanceof DOMMatrix)) collectPoints(value, points);
  }
  if (points.length === 0) return;

  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function collectPoints(object: GameObject, points: WorldPoint[]) {
  const own = pointOf(object);
  if (own) {
    points.push(own);
    return;
  }
  for (const value of Object.values(object)) {
    if (isObject(value) && !(value instanceof DOMMatrix)) collectPoints(value, points);
  }
}

function pointOf(object: GameObject): WorldPoint | undefined {
  const matrix = transform(object)?.matrix;
  if (!matrix) return;

  const width = Number(object.width);
  const height = Number(object.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { x: matrix.e, y: matrix.f };
  }

  return center({ transform: matrix, width, height });
}

const borderRadius = "0.25rem";

const row = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
  width: "100%",
  boxSizing: "border-box",
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
  borderRadius,
  "&:hover": {
    background: "#262626",
  },
  "&[aria-current='true']": {
    background: "#333333",
  },
  "&[aria-current='true']:hover": {
    background: "#3f3f46",
  },
  "& > button": {
    visibility: "hidden",
  },
  "&:hover > button": {
    visibility: "visible",
  },
});

const label = css({
  cursor: "pointer",
  flex: "1 1 auto",
  minWidth: 0,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
});

const expandable = css({
  "& > span > :last-child": {
    visibility: "hidden",
  },
  "&:hover > span > :first-child": {
    visibility: "hidden",
  },
  "&:hover > span > :last-child": {
    visibility: "visible",
  },
});

const iconButton = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius,
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  marginLeft: "auto",
  padding: 0,
  width: "1.25rem",
  height: "1.25rem",
  font: "inherit",
  lineHeight: 1,
  "&:hover": {
    background: "#333333",
  },
  "&:focus-visible": {
    background: "#333333",
    outline: "1px solid currentColor",
    outlineOffset: "1px",
  },
});
