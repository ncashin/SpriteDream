import type { IconNode } from "lucide";
import Box from "lucide/dist/esm/icons/box.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import Braces from "lucide/dist/esm/icons/braces.mjs";
import Trash from "lucide/dist/esm/icons/trash.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { isObject } from "../../utilities/is-object.ts";
import { deselectObject, selectedObjects } from "../../utilities/selected-objects.ts";
import { applyTrait, traits } from "../../utilities/trait/trait.ts";
import "../../utilities/physics.ts";
import "../../utilities/viewport/draw-image.ts";
import "../../utilities/viewport/frame.tsx";
import "../../utilities/viewport/transform.ts";
import { AutoSizeInput } from "./auto-size-input.tsx";
import { Dropdown, type DropdownItem } from "./dropdown.tsx";
import { PropertyInput } from "./property-input.tsx";
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

export type GameObject = { [key in PropertyKey]: any };

export const ObjectTree = clientEntry(
  import.meta.url,
  function ObjectTree(handle: Handle<{ object: GameObject; name?: string; parent?: GameObject }>) {
    if (typeof requestAnimationFrame === "function") {
      let frame = requestAnimationFrame(function tick() {
        if (handle.signal.aborted) return;
        handle.update();
        frame = requestAnimationFrame(tick);
      });
      handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
    }

    return () => {
      const { object, name, parent } = handle.props;
      if (!name || !parent) return <GameObjectList object={object} />;

      return (
        <Branch
          name={name}
          object={object}
          onRename={(from, to) => {
            if (Object.hasOwn(parent, to)) return false;
            renameKey(parent, from, to);
            for (const value of Object.values(parent)) {
              if (isObject(value) && !(value instanceof DOMMatrix) && value.parent === from) {
                value.parent = to;
              }
            }
            handle.update();
          }}
          onDelete={() => {
            deselectObject(object);
            delete parent[name];
            handle.update();
          }}
        />
      );
    };
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
            {name === "__icon" ? null : isObject(value) && !(value instanceof DOMMatrix) ? (
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

function addItems(object: GameObject, done: () => void): DropdownItem[] {
  const items: DropdownItem[] = [];
  for (const entry of traits) {
    items.push({
      label: entry.name,
      icon: entry.icon,
      onSelect: () => {
        applyTrait(entry.trait, object);
        if (!(object.transform instanceof DOMMatrix)) object.transform = new DOMMatrix();
        done();
      },
    });
  }
  items.push(
    {
      label: "New Property",
      icon: Braces,
      onSelect: () => {
        object[uniqueKey(object, "new")] = "";
        done();
      },
    },
    {
      label: "New Object",
      icon: Box,
      onSelect: () => {
        object[uniqueKey(object, "object")] = {};
        done();
      },
    },
  );
  return items;
}

function uniqueKey(object: GameObject, base: string) {
  let key = base;
  let n = 2;
  while (Object.hasOwn(object, key)) key = `${base}${n++}`;
  return key;
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

  return () => {
    const { name, object, onRename, onDelete } = handle.props;

    const isSelected = selectedObjects.has(object);
    return (
      <>
        <div
          aria-current={isSelected ? "true" : undefined}
          aria-expanded={!collapsed}
          mix={[
            row,
            expandable,
            on("click", (event) => {
              const target = event.target instanceof Element ? event.target : null;
              if (target?.closest("button, input")) return;
              collapsed = !collapsed;
              handle.update();
            }),
          ]}
        >
          <div mix={label}>
            <span mix={[iconStack, iconMotion, !collapsed && chevronOpen]}>
              <Icon icon={iconFor(object)} size={14} />
              <Icon icon={ChevronRight} size={14} />
            </span>
            <AutoSizeInput
              value={name}
              placeholder="object"
              label="Object"
              onCommit={(next) => onRename(name, next)}
            />
          </div>
          <Dropdown
            label={`Add to ${name}`}
            items={addItems(object, () => {
              collapsed = false;
              handle.update();
            })}
          />
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
        <div mix={[childrenPanel, !collapsed && childrenOpen]}>
          <div mix={[childrenClip, indent]}>
            <GameObjectList object={object} />
          </div>
        </div>
      </>
    );
  };
}

function iconFor(object: GameObject): IconNode {
  return isIconNode(object.__icon) ? object.__icon : Box;
}

function isIconNode(value: unknown): value is IconNode {
  return (
    Array.isArray(value) &&
    value.every(
      (part) => Array.isArray(part) && typeof part[0] === "string" && isObject(part[1]),
    )
  );
}

export function renameKey(object: GameObject, from: string, to: string) {
  const renamed: GameObject = {};
  for (const [key, value] of Object.entries(object)) {
    renamed[key === from ? to : key] = value;
  }
  for (const key of Object.keys(object)) delete object[key];
  Object.assign(object, renamed);
}

