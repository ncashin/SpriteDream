import Box from "lucide/dist/esm/icons/box.mjs";
import SearchIcon from "lucide/dist/esm/icons/search.mjs";
import { css, on, ref } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import type { SceneNode } from "../../scene.ts";
import { scene } from "../../scene.ts";
import { selectObjects, selectedObjects } from "../../selected-objects.ts";
import type { GameObject } from "./object-tree.tsx";

const LIST_ID = "object-search-list";

function gameObject(value: SceneNode): GameObject | undefined {
  if (typeof value !== "object" || value === null) return;
  return value as GameObject;
}

function topLevelObjects() {
  let objects: { name: string; object: GameObject }[] = [];
  for (let [name, value] of Object.entries(scene)) {
    let object = gameObject(value);
    if (object) objects.push({ name, object });
  }
  return objects;
}

function matchingObjects(query: string) {
  let needle = query.trim().toLowerCase();
  if (needle === "") return topLevelObjects();
  return topLevelObjects().filter((item) => item.name.toLowerCase().includes(needle));
}

export function Search(handle: Handle) {
  let query = "";
  let open = false;
  let activeIndex = 0;
  let input: HTMLInputElement | null = null;

  function choose(index: number) {
    let item = matchingObjects(query)[index];
    if (!item) return;
    selectObjects([item.object]);
    query = "";
    open = false;
    activeIndex = 0;
    input?.blur();
    handle.update();
  }

  function focusSearch() {
    let items = matchingObjects(query);
    let current = items.findIndex((item) => selectedObjects.includes(item.object));
    activeIndex = current === -1 ? 0 : current;
    open = true;
    handle.update();
    input?.focus();
    input?.select();
  }

  if (typeof window !== "undefined") {
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.repeat || event.altKey || event.shiftKey) return;
        if (event.key.toLowerCase() !== "p") return;
        if (!event.metaKey && !event.ctrlKey) return;
        event.preventDefault();
        event.stopPropagation();
        focusSearch();
      },
      { capture: true, signal: handle.signal },
    );
  }

  return () => {
    let items = open ? matchingObjects(query) : [];
    let index = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);

    return (
      <div mix={slot}>
        <div mix={box}>
          <label mix={field}>
            <Icon icon={SearchIcon} size={14} />
            <input
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={LIST_ID}
              aria-expanded={open}
              aria-label="Search objects"
              aria-activedescendant={open && items.length > 0 ? `${LIST_ID}-${index}` : undefined}
              autocomplete="off"
              placeholder="Search objects"
              spellcheck={false}
              value={query}
              mix={[
                inputStyle,
                ref((node) => {
                  input = node instanceof HTMLInputElement ? node : null;
                }),
                on("focus", () => {
                  open = true;
                  handle.update();
                }),
                on("blur", () => {
                  open = false;
                  handle.update();
                }),
                on("input", (event) => {
                  query = event.currentTarget.value;
                  activeIndex = 0;
                  open = true;
                  handle.update();
                }),
                on("keydown", (event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    let count = matchingObjects(query).length;
                    if (count === 0) return;
                    open = true;
                    activeIndex = Math.min(index + 1, count - 1);
                    handle.update();
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    activeIndex = Math.max(index - 1, 0);
                    handle.update();
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    choose(index);
                    return;
                  }
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  query = "";
                  open = false;
                  activeIndex = 0;
                  event.currentTarget.blur();
                  handle.update();
                }),
              ]}
            />
            {query === "" ? (
              <kbd aria-hidden="true" mix={kbd}>
                ⌘P
              </kbd>
            ) : null}
          </label>
          {open ? (
            <ul id={LIST_ID} role="listbox" aria-label="Top level objects" mix={list}>
              {items.length === 0 ? (
                <li mix={empty}>No matching objects</li>
              ) : (
                items.map((item, itemIndex) => (
                  <li
                    id={`${LIST_ID}-${itemIndex}`}
                    key={item.name}
                    role="option"
                    aria-selected={itemIndex === index}
                    mix={[
                      option,
                      itemIndex === index && active,
                      on("pointerdown", (event) => {
                        event.preventDefault();
                        choose(itemIndex);
                      }),
                      on("pointermove", () => {
                        if (activeIndex === itemIndex) return;
                        activeIndex = itemIndex;
                        handle.update();
                      }),
                    ]}
                  >
                    <Icon icon={Box} size={14} />
                    {item.name}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>
    );
  };
}

const slot = css({
  display: "flex",
  flex: "1 1 auto",
  justifyContent: "center",
  minWidth: 0,
  pointerEvents: "none",
});

const box = css({
  borderRadius: "0.25rem",
  boxSizing: "border-box",
  minWidth: 0,
  pointerEvents: "auto",
  width: "min(24rem, 100%)",
  "&:hover, &:focus-within": {
    background: "#262626",
  },
});

const field = css({
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: "0.25rem",
  boxSizing: "border-box",
  color: "inherit",
  display: "flex",
  flexDirection: "row",
  fontSize: "0.875rem",
  gap: "0.25rem",
  lineHeight: "1.25rem",
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
  width: "100%",
});

const inputStyle = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  boxSizing: "border-box",
  color: "inherit",
  flex: "1 1 auto",
  font: "inherit",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  margin: 0,
  minWidth: 0,
  outline: "none",
  padding: 0,
  width: "100%",
  "&::placeholder": {
    color: "inherit",
    opacity: 0.5,
  },
  "&:focus, &:focus-visible": {
    outline: "none",
  },
  "&::-webkit-search-cancel-button, &::-webkit-search-decoration": {
    appearance: "none",
  },
});

const kbd = css({
  color: "inherit",
  flex: "0 0 auto",
  font: "inherit",
  lineHeight: "inherit",
  opacity: 0.5,
});

const list = css({
  listStyle: "none",
  margin: 0,
  maxHeight: "16rem",
  overflow: "auto",
  padding: 0,
});

const option = css({
  alignItems: "center",
  borderRadius: "0.25rem",
  boxSizing: "border-box",
  cursor: "pointer",
  display: "flex",
  fontSize: "0.875rem",
  gap: "0.25rem",
  lineHeight: "1.25rem",
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
  width: "100%",
});

const active = css({
  background: "#333333",
});

const empty = css({
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  opacity: 0.6,
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
});
