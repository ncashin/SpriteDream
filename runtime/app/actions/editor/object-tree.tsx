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
import { PropertyInput } from "./property-input.tsx";

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
            {isObject(value) ? (
              <Branch
                name={name}
                object={value}
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
    onDelete: () => void;
  }>,
) {
  let collapsed = false;

  return () => {
    const { name, object, onDelete } = handle.props;

    return (
      <>
        <div aria-current={selectedObjects.includes(object) ? "true" : undefined} mix={row}>
          <div
            aria-expanded={!collapsed}
            mix={[
              css({
                cursor: "pointer",
                flex: "1 1 auto",
                minWidth: 0,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "0.25rem",
                "& > span > :last-child": {
                  visibility: "hidden",
                },
                "&:hover > span > :first-child": {
                  visibility: "hidden",
                },
                "&:hover > span > :last-child": {
                  visibility: "visible",
                },
              }),
              on("click", () => {
                collapsed = !collapsed;
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
              <Icon icon={collapsed ? ChevronRight : ChevronDown} size={14} />
            </span>
            {name}
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
          <div mix={css({ paddingLeft: "0.75rem" })}>
            <GameObjectList object={object} />
          </div>
        )}
      </>
    );
  };
}

function renameKey(object: GameObject, from: string, to: string) {
  const renamed: GameObject = {};
  for (const [key, value] of Object.entries(object)) {
    renamed[key === from ? to : key] = value;
  }
  for (const key of Object.keys(object)) delete object[key];
  Object.assign(object, renamed);
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

