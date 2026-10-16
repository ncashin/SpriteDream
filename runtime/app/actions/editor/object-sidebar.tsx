import { clientEntry, css } from "remix/component";
import type { Handle } from "remix/component";

import { isObject } from "../../utilities/is-object.ts";
import { scene, type SceneNode } from "../../utilities/scene.ts";
import { selectedObjects } from "../../utilities/selected-objects.ts";
import { ObjectTree } from "./object-tree.tsx";

export const OBJECT_SIDEBAR_WIDTH = "20rem";

export const ObjectSidebar = clientEntry(import.meta.url, function ObjectSidebar(handle: Handle<{ collapsed?: boolean }>) {
  let active: SceneNode | undefined;

  if (typeof requestAnimationFrame === "function") {
    let frame = requestAnimationFrame(function tick() {
      if (handle.signal.aborted) return;
      handle.update();
      frame = requestAnimationFrame(tick);
    });
    handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
  }

  return () => {
    if (!active || !selectedObjects.has(active)) active = selectedObjects.values().next().value;
    const entry = active ? findEntry(scene, active) : undefined;

    const collapsed = handle.props.collapsed === true;

    return (
      <aside id="object-view" data-sidebar="" mix={panel} style={{ width: collapsed ? "0rem" : OBJECT_SIDEBAR_WIDTH }}>
        <div inert={collapsed} mix={column}>
          <h2 mix={heading}>Selected Objects</h2>
          {active ? (
            <div mix={tree}>
              <ObjectTree
                key={entry?.key ?? active}
                object={active}
                name={entry?.key}
                parent={entry?.parent}
              />
            </div>
          ) : null}
        </div>
      </aside>
    );
  };
});

function findEntry(root: SceneNode, target: SceneNode): { parent: SceneNode; key: string } | undefined {
  for (const [key, value] of Object.entries(root)) {
    if (value === target) return { parent: root, key };
    if (!isObject(value) || value instanceof DOMMatrix) continue;
    const nested = findEntry(value, target);
    if (nested) return nested;
  }
}

const panel = css({
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  flex: "0 0 auto",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
  transition: "width 200ms ease",
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const column = css({
  boxSizing: "border-box",
  borderRight: "1px solid #262626",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  minHeight: 0,
  width: OBJECT_SIDEBAR_WIDTH,
});

const heading = css({
  color: "#f4f4f5",
  flex: "0 0 auto",
  fontSize: "0.875rem",
  fontWeight: 400,
  lineHeight: "1.25rem",
  margin: 0,
  padding: "1rem 1rem 0.25rem",
});

const tree = css({
  boxSizing: "border-box",
  flex: "1 1 0",
  minHeight: 0,
  overflow: "auto",
  padding: "0.25rem 0.625rem 1rem",
});
