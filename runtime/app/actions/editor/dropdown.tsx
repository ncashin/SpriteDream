import type { IconNode } from "lucide";
import Plus from "lucide/dist/esm/icons/plus.mjs";
import SearchIcon from "lucide/dist/esm/icons/search.mjs";
import { css, on, ref } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { iconButton } from "./tree.ts";

export type DropdownItem = {
  label: string;
  icon?: IconNode;
  onSelect: () => void;
};

export function Dropdown(handle: Handle<{ label: string; items: DropdownItem[] }>) {
  let open = false;
  let query = "";
  let button: HTMLButtonElement | null = null;
  let menu: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;

  function matches(item: string) {
    const needle = query.trim().toLowerCase();
    return needle === "" || item.toLowerCase().includes(needle);
  }

  function choose(item: DropdownItem) {
    menu?.hidePopover();
    item.onSelect();
  }

  function place() {
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const margin = 4;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let top = rect.bottom + margin;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - margin - height);
    let left = rect.right - width;
    if (left < margin) left = margin;
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  return () => {
    const { label } = handle.props;
    const items = handle.props.items.filter((item) => matches(item.label));
    const itemButtons: HTMLButtonElement[] = [];

    return (
      <>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          mix={[
            iconButton,
            ref((node) => {
              button = node instanceof HTMLButtonElement ? node : null;
            }),
            on("click", (event) => {
              event.stopPropagation();
              if (!menu) return;
              if (menu.matches(":popover-open")) {
                menu.hidePopover();
                return;
              }
              menu.showPopover();
              place();
            }),
          ]}
        >
          <Icon icon={Plus} size={14} />
        </button>
        <div
          popover="auto"
          role="menu"
          mix={[
            menuStyle,
            ref((node) => {
              menu = node instanceof HTMLElement ? node : null;
            }),
            on("pointerdown", (event) => {
              event.stopPropagation();
            }),
            on("click", (event) => {
              event.stopPropagation();
            }),
            on("toggle", (event) => {
              const current = menu;
              if (!(event instanceof ToggleEvent) || !current || event.target !== current) return;
              const next = event.newState === "open";
              if (next) {
                place();
                input?.focus();
              } else {
                query = "";
              }
              if (open === next) return;
              open = next;
              handle.update();
            }),
          ]}
        >
          <div mix={menuList}>
            <div mix={searchBox}>
              <label mix={searchField}>
                <Icon icon={SearchIcon} size={14} />
                <input
                  type="text"
                  aria-label="Search"
                  autocomplete="off"
                  placeholder="Search"
                  spellcheck={false}
                  value={query}
                  mix={[
                    searchInput,
                    ref((node) => {
                      input = node instanceof HTMLInputElement ? node : null;
                    }),
                    on("input", (event) => {
                      query = event.currentTarget.value;
                      handle.update();
                      requestAnimationFrame(place);
                    }),
                    on("keydown", (event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        itemButtons[0]?.focus();
                        return;
                      }
                      const first = items[0];
                      if (event.key !== "Enter" || !first) return;
                      event.preventDefault();
                      choose(first);
                    }),
                  ]}
                />
              </label>
            </div>
            {items.length > 0 ? (
              items.map((item, index) => (
                <button
                  type="button"
                  role="menuitem"
                  key={item.label}
                  mix={[
                    menuItem,
                    ref((node) => {
                      if (node instanceof HTMLButtonElement) itemButtons[index] = node;
                    }),
                    on("click", (event) => {
                      event.stopPropagation();
                      choose(item);
                    }),
                    on("keydown", (event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        itemButtons[index + 1]?.focus();
                        return;
                      }
                      if (event.key !== "ArrowUp") return;
                      event.preventDefault();
                      if (index === 0) input?.focus();
                      else itemButtons[index - 1]?.focus();
                    }),
                  ]}
                >
                  {item.icon ? <Icon icon={item.icon} size={14} /> : null}
                  {item.label}
                </button>
              ))
            ) : (
              <div mix={empty}>No matches</div>
            )}
          </div>
        </div>
      </>
    );
  };
}

const menuStyle = css({
  background: "canvas",
  border: "1px solid #3f3f46",
  borderRadius: "0.25rem",
  color: "#f4f4f5",
  inset: "auto",
  margin: 0,
  minWidth: "12rem",
  padding: "0.25rem",
  position: "fixed",
});

const menuList = css({
  display: "flex",
  flexDirection: "column",
});

const searchBox = css({
  borderRadius: "0.25rem",
  boxSizing: "border-box",
  minWidth: 0,
  width: "100%",
});

const searchField = css({
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

const searchInput = css({
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

const empty = css({
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  opacity: 0.6,
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
});

const menuItem = css({
  alignItems: "center",
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "0.25rem",
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  flexDirection: "row",
  font: "inherit",
  fontSize: "0.875rem",
  gap: "0.25rem",
  lineHeight: "1.25rem",
  padding: "0.25rem 0.5rem",
  textAlign: "left",
  width: "100%",
  "&:hover, &:focus-visible": {
    background: "#333333",
    outline: "none",
  },
});
