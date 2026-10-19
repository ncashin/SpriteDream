import Box from "lucide/dist/esm/icons/box.mjs";
import File from "lucide/dist/esm/icons/file.mjs";
import SearchIcon from "lucide/dist/esm/icons/search.mjs";
import { css, on, ref } from "remix/component";
import type { Handle } from "remix/component";

import { routes } from "../../routes.ts";
import { Icon } from "../../icon.tsx";
import { hotkeys } from "../../utilities/hotkey.ts";
import { isObject } from "../../utilities/is-object.ts";
import { loadScene, saveSceneHotkey, scene, type SceneNode } from "../../utilities/scene.ts";
import { selectObjects } from "../../utilities/selected-objects.ts";

const LIST_ID = "scene-search-list";

type SearchItem =
  | { kind: "scene"; name: string }
  | { kind: "object"; name: string; object: SceneNode };

function sceneObjects(): SearchItem[] {
  return Object.entries(scene).flatMap(([name, value]) =>
    isObject(value) ? [{ kind: "object" as const, name, object: value }] : [],
  );
}

function fuzzyScore(text: string, query: string) {
  let haystack = text.toLowerCase();
  let needle = query.trim().toLowerCase();
  if (needle === "") return 1;
  if (haystack === needle) return 1000;
  if (haystack.startsWith(needle)) return 800;
  let contains = haystack.indexOf(needle);
  if (contains !== -1) return 600 - contains;

  let score = 0;
  let index = 0;
  let streak = 0;
  for (let char of needle) {
    let found = haystack.indexOf(char, index);
    if (found === -1) return 0;
    streak = found === index ? streak + 1 : 1;
    score += 10 + streak * 5;
    let previous = haystack[found - 1];
    if (found === 0 || previous === " " || previous === "-" || previous === "_" || previous === "/") {
      score += 8;
    }
    index = found + 1;
  }
  return score;
}

function matchingItems(scenes: string[], query: string): SearchItem[] {
  let items: SearchItem[] = [
    ...scenes.map((name) => ({ kind: "scene" as const, name })),
    ...sceneObjects(),
  ];
  return items
    .map((item) => ({ item, score: fuzzyScore(item.name, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((entry) => entry.item);
}

function openInFrames(name: string, target: Window = window) {
  for (let index = 0; index < target.frames.length; index++) {
    let child = target.frames[index];
    if (!child) continue;
    try {
      child.postMessage({ type: "openScene", name }, location.origin);
      openInFrames(name, child);
    } catch {
      // A cross-origin frame cannot be reached.
    }
  }
}

export function Search(handle: Handle) {
  let query = "";
  let open = false;
  let activeIndex = 0;
  let scenes: string[] = [];
  let current = "Example Scene";
  let input: HTMLInputElement | null = null;

  function setOpen(next: boolean) {
    open = next;
  }

  function refreshScenes() {
    void fetch(routes.editor.scenes.href()).then(async (response) => {
      if (!response.ok) return;
      let next: unknown = await response.json();
      if (!Array.isArray(next)) return;
      scenes = next.filter((name): name is string => typeof name === "string");
      handle.update();
    });
  }

  function choose(index: number) {
    let item = matchingItems(scenes, query)[index];
    if (!item) return;
    query = "";
    setOpen(false);
    activeIndex = 0;
    input?.blur();
    if (item.kind === "object") {
      selectObjects([item.object]);
      handle.update();
      return;
    }
    current = item.name;
    selectObjects([]);
    void loadScene(item.name);
    openInFrames(item.name);
    handle.update();
  }

  function focusSearch() {
    refreshScenes();
    let items = matchingItems(scenes, query);
    let currentIndex = items.findIndex((item) => item.kind === "scene" && item.name === current);
    activeIndex = currentIndex === -1 ? 0 : currentIndex;
    setOpen(true);
    handle.update();
    input?.focus();
    input?.select();
  }

  saveSceneHotkey(handle.signal);

  hotkeys(
    {
      "mod+p": (event) => {
        event.preventDefault();
        event.stopPropagation();
        focusSearch();
      },
    },
    { signal: handle.signal },
  );

  return () => {
    let items = open ? matchingItems(scenes, query) : [];
    let index = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);

    return (
      <div mix={slot}>
        <div mix={box} data-expanded={open ? "" : undefined}>
          <label mix={field}>
            <Icon icon={SearchIcon} size={14} />
            <input
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={LIST_ID}
              aria-expanded={open}
              aria-label="Search"
              aria-activedescendant={open && items.length > 0 ? `${LIST_ID}-${index}` : undefined}
              autocomplete="off"
              placeholder="Search"
              spellcheck={false}
              value={query}
              mix={[
                inputStyle,
                ref((node) => {
                  input = node instanceof HTMLInputElement ? node : null;
                }),
                on("focus", () => {
                  refreshScenes();
                  setOpen(true);
                  handle.update();
                }),
                on("blur", () => {
                  setOpen(false);
                  handle.update();
                }),
                on("input", (event) => {
                  query = event.currentTarget.value;
                  activeIndex = 0;
                  setOpen(true);
                  handle.update();
                }),
                on("keydown", (event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    let count = matchingItems(scenes, query).length;
                    if (count === 0) return;
                    setOpen(true);
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
                  setOpen(false);
                  activeIndex = 0;
                  event.currentTarget.blur();
                  handle.update();
                }),
              ]}
            />
            {query === "" && (
              <kbd aria-hidden="true" mix={kbd}>
                ⌘P
              </kbd>
            )}
          </label>
          <div mix={[drawer, open && drawerOpen]}>
            <div mix={drawerInner}>
              <div mix={rule} />
              <ul id={LIST_ID} role="listbox" aria-label="Search results" mix={list}>
                {items.length === 0 ? (
                  <li mix={empty}>No matches</li>
                ) : (
                  items.map((item, itemIndex) => (
                    <li
                      id={`${LIST_ID}-${itemIndex}`}
                      key={item.kind === "scene" ? `scene:${item.name}` : `object:${item.name}`}
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
                      <Icon icon={item.kind === "scene" ? File : Box} size={14} />
                      {item.name}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
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
  background: "transparent",
  borderRadius: "0.6em",
  fontSize: "13px",
  boxSizing: "border-box",
  minWidth: 0,
  overflow: "hidden",
  pointerEvents: "auto",
  position: "relative",
  width: "min(24rem, 100%)",
  "&:hover, &:focus-within, &[data-expanded]": {
    background: "var(--hover)",
  },
});

const field = css({
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: "0.6em",
  boxSizing: "border-box",
  color: "inherit",
  display: "flex",
  flexDirection: "row",
  fontSize: "13px",
  gap: "0.3em",
  lineHeight: 1.35,
  padding: "0.45em 0.55em",
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
  fontSize: "13px",
  lineHeight: 1.35,
  margin: 0,
  minWidth: 0,
  outline: "none",
  padding: 0,
  width: "100%",
  "&::placeholder": {
    color: "var(--text-muted)",
    opacity: 1,
  },
  "&:focus, &:focus-visible": {
    outline: "none",
  },
  "&::-webkit-search-cancel-button, &::-webkit-search-decoration": {
    appearance: "none",
  },
});

const kbd = css({
  flex: "0 0 auto",
  font: "inherit",
  lineHeight: "inherit",
  color: "var(--text-muted)",
});

const drawer = css({
  display: "grid",
  gridTemplateRows: "0fr",
});

const drawerOpen = css({
  gridTemplateRows: "1fr",
});

const drawerInner = css({
  minHeight: 0,
  overflow: "hidden",
});

const rule = css({
  borderTop: "1px solid var(--line)",
});

const list = css({
  listStyle: "none",
  margin: 0,
  maxHeight: "16rem",
  overflow: "auto",
  padding: "0.25rem",
});

const option = css({
  alignItems: "center",
  borderRadius: "6px",
  boxSizing: "border-box",
  cursor: "pointer",
  display: "flex",
  fontSize: "13px",
  gap: "0.25rem",
  lineHeight: 1.35,
  padding: "0.25rem 0.5rem",
  width: "100%",
});

const active = css({
  background: "#ffffff18",
});

const empty = css({
  color: "var(--text-muted)",
  fontSize: "13px",
  lineHeight: 1.35,
  padding: "0.25rem 0.5rem",
});
