import type { IconNode } from "lucide";
import Box from "lucide/dist/esm/icons/box.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import Braces from "lucide/dist/esm/icons/braces.mjs";
import Trash from "lucide/dist/esm/icons/trash.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { isObject } from "../../utilities/is-object.ts";
import type { SceneNode } from "../../utilities/scene.ts";
import { deselectObject, selectedObjects } from "../../utilities/selected-objects.ts";
import { applyTrait, traits } from "../../utilities/trait/trait.ts";
import { textTrait } from "../../utilities/viewport/draw-text.ts";
import "../../utilities/physics.ts";
import "../../utilities/viewport/draw-image.ts";
import "../../utilities/viewport/frame.tsx";
import { createMatrix, isMatrix } from "../../utilities/viewport/transform.ts";
import { AutoSizeInput } from "./auto-size-input.tsx";
import { Button } from "./button.tsx";
import { Dropdown, type DropdownItem } from "./dropdown.tsx";
import { PropertyInput } from "./property-input.tsx";
import {
  chevronOpen,
  childrenClip,
  childrenOpen,
  childrenPanel,
  expandable,
  iconMotion,
  iconStack,
  label,
  row,
  rowShell,
  stickyHeader,
} from "./tree.ts";

export const ObjectTree = clientEntry(
  import.meta.url,
  function ObjectTree(handle: Handle<{ object: SceneNode; name?: string; parent?: SceneNode }>) {
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
      if (!name || !parent) return <SceneNodeList object={object} />;

      return (
        <Branch
          depth={0}
          name={name}
          object={object}
          onRename={(from, to) => {
            if (Object.hasOwn(parent, to)) return false;
            renameKey(parent, from, to);
            for (const value of Object.values(parent)) {
              if (isObject(value) && value.parent === from) value.parent = to;
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

function SceneNodeList(handle: Handle<{ object: SceneNode; depth?: number }>) {
  return () => {
    const { object, depth = 0 } = handle.props;
    if (Object.keys(object).length === 0) return null;

    return (
      <div>
        {Object.entries(object).map(([name, value]) => (
          <div key={name}>
            {name === "__icon" ? null : isObject(value) ? (
              <Branch
                depth={depth}
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
                depth={depth}
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

function addItems(object: SceneNode, done: () => void): DropdownItem[] {
  const items: DropdownItem[] = [];
  for (const entry of traits) {
    if (entry.trait === textTrait) continue;
    items.push({
      label: entry.name,
      icon: entry.icon,
      onSelect: () => {
        applyTrait(entry.trait, object);
        if (!isMatrix(object.transform)) object.transform = createMatrix();
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

function uniqueKey(object: SceneNode, base: string) {
  let key = base;
  let n = 2;
  while (Object.hasOwn(object, key)) key = `${base}${n++}`;
  return key;
}

const actions = css({
  alignItems: "center",
  display: "flex",
  flex: "0 0 auto",
  gap: 0,
  marginLeft: "auto",
  "& > button": {
    marginLeft: 0,
  },
});

function Branch(
  handle: Handle<{
    depth: number;
    name: string;
    object: SceneNode;
    onRename: (from: string, to: string) => boolean | void;
    onDelete: () => void;
  }>,
) {
  let collapsed = isEmpty(handle.props.object);
  let empty = collapsed;

  return () => {
    const { depth, name, object, onRename, onDelete } = handle.props;
    const nowEmpty = isEmpty(object);
    if (nowEmpty !== empty) {
      collapsed = nowEmpty;
      empty = nowEmpty;
    }

    const isSelected = selectedObjects.has(object);
    return (
      <>
        <div style={{ "--tree-depth": String(depth) }} mix={[rowShell, stickyHeader]}>
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
          <div mix={actions}>
            <Dropdown
              label={`Add to ${name}`}
              text="Add"
              items={addItems(object, () => {
                collapsed = false;
                handle.update();
              })}
            />
            <Button
              size="small"
              muted
              label={`Delete ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Icon icon={Trash} size={11} />
              Delete
            </Button>
          </div>
        </div>
        </div>
        <div mix={[childrenPanel, !collapsed && childrenOpen]}>
          <div mix={childrenClip}>
            <SceneNodeList object={object} depth={depth + 1} />
          </div>
        </div>
      </>
    );
  };
}

function isEmpty(object: SceneNode) {
  return Object.keys(object).every((key) => key === "__icon");
}

function iconFor(object: SceneNode): IconNode {
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

export function renameKey(object: SceneNode, from: string, to: string) {
  const renamed: SceneNode = {};
  for (const [key, value] of Object.entries(object)) {
    renamed[key === from ? to : key] = value;
  }
  for (const key of Object.keys(object)) delete object[key];
  Object.assign(object, renamed);
}

