import Box from "lucide/dist/esm/icons/box.mjs";
import ChevronDown from "lucide/dist/esm/icons/chevron-down.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import Plus from "lucide/dist/esm/icons/plus.mjs";
import Trash from "lucide/dist/esm/icons/trash.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { isObject } from "../../utilities/is-object.ts";
import { selectedObjects } from "../../utilities/selected-objects.ts";
import { AutoSizeInput } from "./auto-size-input.tsx";
import { PropertyInput } from "./property-input.tsx";
import { expandable, iconButton, iconStack, indent, label, row } from "./tree.ts";

export type GameObject = { [key in PropertyKey]: any };

export const ObjectTree = clientEntry(
  import.meta.url,
  function ObjectTree(handle: Handle<{ object: GameObject }>) {
    if (typeof requestAnimationFrame === "function") {
      let frame = requestAnimationFrame(function tick() {
        if (handle.signal.aborted) return;
        handle.update();
        frame = requestAnimationFrame(tick);
      });
      handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
    }

    return () => <GameObjectList object={handle.props.object} />;
  },
);

function GameObjectList(handle: Handle<{ object: GameObject }>) {
  return () => {
    const { object } = handle.props;
    if (Object.keys(object).length === 0) return null;

    return (
      <div>
        {Object.entries(object).map(([name, value]) => (
          <div key={name}>
            {isObject(value) && !(value instanceof DOMMatrix) ? (
              <Branch
                name={name}
                object={value}
                onRename={(from, to) => {
                  if (Object.hasOwn(object, to)) return false;
                  renameKey(object, from, to);
                  handle.update();
                }}
                onDelete={() => {
                  delete object[name];
                  handle.update();
                }}
              />
            ) : (
              <PropertyInput
                name={name}
                object={object}
                onRename={(from, to) => {
                  renameKey(object, from, to);
                  handle.update();
                }}
                onDelete={() => {
                  delete object[name];
                  handle.update();
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };
}

function Branch(
  handle: Handle<{
    name: string;
    object: GameObject;
    onRename: (from: string, to: string) => boolean | void;
    onDelete: () => void;
  }>,
) {
  let collapsed = false;
  let name = handle.props.name;

  return () => {
    const { object, onRename, onDelete } = handle.props;

    return (
      <>
        <div aria-current={selectedObjects.has(object) ? "true" : undefined} mix={row}>
          <div
            aria-expanded={!collapsed}
            mix={[
              label,
              expandable,
              on("click", () => {
                collapsed = !collapsed;
                handle.update();
              }),
            ]}
          >
            <span mix={iconStack}>
              <Icon icon={Box} size={14} />
              <Icon icon={collapsed ? ChevronRight : ChevronDown} size={14} />
            </span>
            <AutoSizeInput
              value={name}
              placeholder="name"
              label="Name"
              onCommit={(next) => onRename(name, next)}
            />
          </div>
          <button
            type="button"
            aria-label={`Add to ${name}`}
            mix={[
              iconButton,
              on("click", (event) => {
                event.stopPropagation();
                let key = "new";
                let n = 2;
                while (Object.hasOwn(object, key)) key = `new${n++}`;
                object[key] = "";
                collapsed = false;
                handle.update();
              }),
            ]}
          >
            <Icon icon={Plus} size={14} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${name}`}
            mix={[
              iconButton,
              css({ marginLeft: "-0.25rem" }),
              on("click", (event) => {
                event.stopPropagation();
                onDelete();
              }),
            ]}
          >
            <Icon icon={Trash} size={14} />
          </button>
        </div>
        {collapsed ? null : (
          <div mix={indent}>
            <GameObjectList object={object} />
          </div>
        )}
      </>
    );
  };
}

export function renameKey(object: GameObject, from: string, to: string) {
  const renamed: GameObject = {};
  for (const [key, value] of Object.entries(object)) {
    renamed[key === from ? to : key] = value;
  }
  for (const key of Object.keys(object)) delete object[key];
  Object.assign(object, renamed);
}

