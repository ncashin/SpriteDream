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

export const ObjectTree = clientEntry(
  import.meta.url,
  function ObjectTree(handle: Handle<{ object: SceneNode }>) {
    if (typeof requestAnimationFrame === "function") {
      let frame = requestAnimationFrame(function tick() {
        if (handle.signal.aborted) return;
        handle.update();
        frame = requestAnimationFrame(tick);
      });
      handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
    }

    return () => <SceneNodeList object={handle.props.object} />;
  },
);

function SceneNodeList(handle: Handle<{ object: SceneNode }>) {
  return () => {
    const { object } = handle.props;
    if (Object.keys(object).length === 0) return null;

    return (
      <div>
        {Object.entries(object).map(([name, value]) => (
          <div key={name}>
            {name === "__icon" ? null : isObject(value) ? (
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

export function SelectedHeader(
  handle: Handle<{
    name: string;
    object: SceneNode;
    onRename: (from: string, to: string) => boolean | void;
    onDelete: () => void;
  }>,
) {
  return () => {
    const { name, object, onRename, onDelete } = handle.props;
    return (
      <div mix={header}>
        <div mix={label}>
          <AutoSizeInput
            value={name}
            placeholder="object"
            label="Selected object"
            onCommit={(next) => onRename(name, next)}
          />
        </div>
        <Dropdown
          label={`Add to ${name}`}
          text="Add"
          items={addItems(object, () => handle.update())}
        />
        <button
          type="button"
          aria-label={`Delete ${name}`}
          mix={[
            iconButton,
            on("click", (event) => {
              event.stopPropagation();
              onDelete();
            }),
          ]}
        >
          <Icon icon={Trash} size={11} />
          Delete
        </button>
      </div>
    );
  };
}

const header = css({
  alignItems: "center",
  boxSizing: "border-box",
  color: "var(--text)",
  display: "flex",
  flex: "0 0 auto",
  flexDirection: "row",
  fontSize: "13px",
  fontWeight: 500,
  gap: "0.25rem",
  lineHeight: 1.35,
  margin: 0,
  minWidth: 0,
  padding: "1rem 1rem 0.5rem",
  "& > button": {
    visibility: "visible",
  },
});

function Branch(
  handle: Handle<{
    name: string;
    object: SceneNode;
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
            text="Add"
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
              on("click", (event) => {
                event.stopPropagation();
                onDelete();
              }),
            ]}
          >
            <Icon icon={Trash} size={11} />
            Delete
          </button>
        </div>
        <div mix={[childrenPanel, !collapsed && childrenOpen]}>
          <div mix={[childrenClip, indent]}>
            <SceneNodeList object={object} />
          </div>
        </div>
      </>
    );
  };
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

