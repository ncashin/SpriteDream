import { clientEntry, css } from "remix/component";
import type { Handle } from "remix/component";

import { isObject } from "../../utilities/is-object.ts";
import { scene, type SceneNode } from "../../utilities/scene.ts";
import { deselectObject, selectedObjects } from "../../utilities/selected-objects.ts";
import { ObjectTree, SelectedHeader, renameKey } from "./object-tree.tsx";

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
    const selected = active && entry ? { object: active, entry } : undefined;

    return (
      <aside id="object-view" inert={collapsed} mix={panel}>
        <div mix={column}>
          {selected ? (
            <SelectedHeader
              name={selected.entry.key}
              object={selected.object}
              onRename={(from, to) => {
                if (Object.hasOwn(selected.entry.parent, to)) return false;
                renameKey(selected.entry.parent, from, to);
                for (const value of Object.values(selected.entry.parent)) {
                  if (isObject(value) && value.parent === from) value.parent = to;
                }
                handle.update();
              }}
              onDelete={() => {
                deselectObject(selected.object);
                delete selected.entry.parent[selected.entry.key];
                handle.update();
              }}
            />
          ) : null}
          {active ? (
            <div mix={tree}>
              <ObjectTree key={selected?.entry.key ?? active} object={active} />
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
    if (!isObject(value)) continue;
    const nested = findEntry(value, target);
    if (nested) return nested;
  }
}

const panel = css({
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  flex: "2 1 66.667%",
  fontSize: "13px",
  lineHeight: 1.35,
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
});

const column = css({
  boxSizing: "border-box",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
});

const tree = css({
  boxSizing: "border-box",
  flex: "1 1 0",
  minHeight: 0,
  overflow: "auto",
  padding: "0.25rem 0.625rem 1rem",
});
