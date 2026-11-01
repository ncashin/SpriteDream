import SearchIcon from "lucide/dist/esm/icons/search.mjs";
import { css, on, ref } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { FileIcon } from "./FileIcon.tsx";
import { createHotkey } from "../../utilities/hotkey.ts";

const LIST_ID = "editor-search-list";

export function Search(handle: Handle<{ items: string[]; onSelect: (item: string) => void }>) {
  let query = "";
  let open = false;
  let activeIndex = 0;
  let input: HTMLInputElement | null = null;

  function focusSearch() {
    open = true;
    handle.update();
    handle.queueTask(() => {
      input?.focus();
      input?.select();
    });
  }

  function onCommandP(event: KeyboardEvent) {
    if (event.repeat) return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "p") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    focusSearch();
  }

  if (typeof window !== "undefined") {
    createHotkey(
      {
        "mod+p": (event) => {
          event.stopImmediatePropagation();
          focusSearch();
        },
      },
      { signal: handle.signal, allowWhileTyping: true },
    );

    let bound = new WeakSet<Window>([window]);
    let bind = (view: Window) => {
      if (bound.has(view)) return;
      bound.add(view);
      try {
        view.addEventListener("keydown", onCommandP, { capture: true, signal: handle.signal });
        view.addEventListener(
          "load",
          (event) => {
            let node = event.target;
            if (node instanceof view.HTMLIFrameElement && node.contentWindow) bind(node.contentWindow);
          },
          { capture: true, signal: handle.signal },
        );
        for (let index = 0; index < view.frames.length; index++) {
          let child = view.frames[index];
          if (child) bind(child);
        }
      } catch {
        // A cross-origin frame cannot be reached.
      }
    };

    window.addEventListener(
      "load",
      (event) => {
        let node = event.target;
        if (node instanceof HTMLIFrameElement && node.contentWindow) bind(node.contentWindow);
      },
      { capture: true, signal: handle.signal },
    );

    for (let index = 0; index < window.frames.length; index++) {
      let child = window.frames[index];
      if (child) bind(child);
    }
  }

  return () => {
    let items = handle.props.items.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase()));
    let index = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);

    function select(item: string) {
      query = "";
      open = false;
      activeIndex = 0;
      input?.blur();
      handle.props.onSelect(item);
      handle.update();
    }

    if (!open) return <></>;

    return (
      <div
        mix={css({
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(36rem, calc(100vw - 2rem))",
          zIndex: 4,
          WebkitAppRegion: "no-drag",
        })}
      >
        <div
          mix={css({
            background: "#232324",
            borderRadius: "0.6em 0.6em 0 0",
            fontSize: "13px",
            position: "relative",
            width: "100%",
          })}
        >
          <label
            mix={css({
              alignItems: "center",
              display: "flex",
              gap: "0.3em",
              padding: "0.45em 0.55em",
            })}
          >
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
                css({
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  flex: 1,
                  font: "inherit",
                  minWidth: 0,
                  outline: "none",
                  padding: 0,
                  "&::placeholder": {
                    color: "var(--text-muted)",
                  },
                }),
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
                    if (items.length === 0) return;
                    open = true;
                    activeIndex = Math.min(index + 1, items.length - 1);
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
                    let item = items[index];
                    if (item) select(item);
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    query = "";
                    open = false;
                    activeIndex = 0;
                    input?.blur();
                    handle.update();
                  }
                }),
              ]}
            />
            {query === "" && (
              <kbd
                aria-hidden="true"
                mix={css({
                  flex: "0 0 auto",
                  font: "inherit",
                  lineHeight: "inherit",
                  color: "var(--text-muted)",
                })}
              >
                ⌘P
              </kbd>
            )}
          </label>
          {open && (
            <ul
              id={LIST_ID}
              role="listbox"
              aria-label="Search results"
              mix={css({
                background: "#232324",
                borderRadius: "0 0 0.6em 0.6em",
                borderTop: "1px solid var(--line)",
                left: 0,
                listStyle: "none",
                margin: 0,
                maxHeight: "16rem",
                overflow: "auto",
                padding: "0.25rem",
                position: "absolute",
                right: 0,
                top: "100%",
              })}
            >
              {items.length === 0 ? (
                <li mix={css({ color: "var(--text-muted)", padding: "0.25rem 0.5rem" })}>No matches</li>
              ) : (
                items.map((item, itemIndex) => (
                  <li
                    id={`${LIST_ID}-${itemIndex}`}
                    key={item}
                    role="option"
                    aria-selected={itemIndex === index}
                    mix={[
                      css({
                        alignItems: "center",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        gap: "0.5rem",
                        padding: "0.25rem 0.65rem 0.25rem 0.5rem",
                      }),
                      itemIndex === index && css({ background: "var(--hover)" }),
                      on("pointerdown", (event) => {
                        event.preventDefault();
                        select(item);
                      }),
                      on("pointermove", () => {
                        if (activeIndex === itemIndex) return;
                        activeIndex = itemIndex;
                        handle.update();
                      }),
                    ]}
                  >
                    <FileIcon path={item} size={14} />
                    <span mix={css({ flex: "0 0 auto" })}>{item.split("/").pop()}</span>
                    <span
                      mix={css({
                        color: "var(--text-muted)",
                        direction: "rtl",
                        marginLeft: "auto",
                        minWidth: 0,
                        overflow: "hidden",
                        textAlign: "left",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      })}
                    >
                      <bdi>
                        {item.includes("/") ? item.slice(0, item.lastIndexOf("/") + 1) : ""}
                      </bdi>
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    );
    };
}
