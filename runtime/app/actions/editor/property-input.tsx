import File from "lucide/dist/esm/icons/file.mjs";
import Trash from "lucide/dist/esm/icons/trash.mjs";
import { css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import type { GameObject } from "./object-tree.tsx";

type PropertyInputProps = {
  name: string;
  object: GameObject;
  onRename: (from: string, to: string) => void;
  onDelete: () => void;
};

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

const field = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: 0,
  boxShadow: "none",
  boxSizing: "border-box",
  color: "inherit",
  display: "block",
  font: "inherit",
  lineHeight: "inherit",
  margin: 0,
  maxWidth: "100%",
  minWidth: 0,
  outline: "none",
  padding: 0,
  "&::placeholder": {
    color: "inherit",
    opacity: 0.5,
  },
  "&:focus, &:focus-visible": {
    outline: "none",
  },
});

const keyLabel = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flex: "0 0 auto",
  color: "var(--text-light)",
});

const keyField = css({
  flex: "0 0 auto",
  fieldSizing: "content",
  width: "auto",
});

const colorPicker = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius,
  boxSizing: "border-box",
  cursor: "pointer",
  flex: "0 0 auto",
  height: "1.25rem",
  margin: 0,
  marginLeft: "auto",
  padding: "calc((1.25rem - 14px) / 2)",
  width: "1.25rem",
  "&::-webkit-color-swatch-wrapper": {
    padding: 0,
  },
  "&::-webkit-color-swatch": {
    border: "1px solid #3f3f46",
    borderRadius: 0,
  },
  "&::-moz-color-swatch": {
    border: "1px solid #3f3f46",
    borderRadius: 0,
  },
  "&:hover": {
    background: "#333333",
  },
  "&:focus-visible": {
    background: "#333333",
    outline: "1px solid currentColor",
    outlineOffset: "1px",
  },
});

const checkbox = css({
  width: "14px",
  height: "14px",
  margin: 0,
  padding: 0,
  "&:focus-visible": {
    outline: "none",
  },
});

const fileControl = css({
  position: "relative",
});

const fileInput = css({
  position: "absolute",
  inset: 0,
  margin: 0,
  opacity: 0,
  cursor: "pointer",
  fontSize: 0,
});

function parseHexColor(value: string): { rgb: string; alpha: string } | null {
  let match = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length <= 4) hex = [...hex].map((digit) => digit + digit).join("");
  return {
    rgb: `#${hex.slice(0, 6).toLowerCase()}`,
    alpha: hex.length === 8 ? hex.slice(6).toLowerCase() : "",
  };
}

function parseBoolean(value: string): { checked: boolean } | null {
  if (value.trim() === "true") return { checked: true };
  if (value.trim() === "false") return { checked: false };
  return null;
}

const DRAG_SLOP = 4;

function parseNumeric(value: string): { value: number; digits: number } | null {
  let text = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  let numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  let dot = text.indexOf(".");
  return { value: numeric, digits: dot === -1 ? 0 : text.length - dot - 1 };
}

function formatNumeric(value: number, digits: number) {
  if (digits === 0) return String(Math.round(value));
  return value.toFixed(digits);
}

function parseFile(value: string): string | null {
  let source = value.trim();
  if (parseNumeric(source)) return null;
  if (source.startsWith("blob:") || source.startsWith("data:")) return source;
  if (/(?:^|\/)[^/]+\.[a-z0-9]*[a-z][a-z0-9]*(?:\?.*)?$/i.test(source)) return source;
  return null;
}

export function PropertyInput(handle: Handle<PropertyInputProps>) {
  let name = handle.props.name;
  let keyDraft = name;
  let object = handle.props.object;

  function commitKey() {
    let next = keyDraft;
    if (next === name) return;
    if (next === "" || Object.hasOwn(handle.props.object, next)) {
      keyDraft = name;
      handle.update();
      return;
    }
    handle.props.onRename(name, next);
  }

  let scrub: {
    pointerId: number;
    originX: number;
    origin: number;
    digits: number;
    dragging: boolean;
    style: HTMLStyleElement;
  } | null = null;

  function endScrub(event?: PointerEvent) {
    if (!scrub || (event && event.pointerId !== scrub.pointerId)) return;
    window.removeEventListener("pointermove", moveScrub);
    window.removeEventListener("pointerup", endScrub);
    window.removeEventListener("pointercancel", endScrub);
    scrub.style.remove();
    scrub = null;
  }

  function moveScrub(event: PointerEvent) {
    if (!scrub || event.pointerId !== scrub.pointerId) return;
    let dx = event.clientX - scrub.originX;
    if (!scrub.dragging) {
      if (Math.abs(dx) <= DRAG_SLOP) return;
      scrub.dragging = true;
      scrub.originX += Math.sign(dx) * DRAG_SLOP;
      dx = event.clientX - scrub.originX;
      document.head.append(scrub.style);
      window.getSelection()?.removeAllRanges();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    object[name] = formatNumeric(scrub.origin + dx, scrub.digits);
    handle.update();
  }

  handle.signal.addEventListener("abort", () => endScrub());

  return () => {
    let current = object[name];
    let value = String(current);
    let color = parseHexColor(value);
    let bool = parseBoolean(value);
    let file = parseFile(value);

    return (
      <div mix={row}>
        <span mix={keyLabel}>
          <input
            type="text"
            aria-label="Key"
            value={keyDraft}
            placeholder="key"
            mix={[
              field,
              keyField,
              on("input", (event) => {
                keyDraft = event.currentTarget.value;
                handle.update();
              }),
              on("blur", commitKey),
              on("keydown", (event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key !== "Escape") return;
                keyDraft = name;
                handle.update();
                event.currentTarget.blur();
              }),
            ]}
          />
          <span aria-hidden="true">:</span>
        </span>
        <input
          type="text"
          aria-label="Value"
          value={value}
          placeholder={name}
          mix={[
            field,
            css({
              flex: "1 1 auto",
              width: "100%",
            }),
            on("input", (event) => {
              object[name] = event.currentTarget.value;
            }),
            on("pointerdown", (event) => {
              if (event.button !== 0) return;
              let numeric = parseNumeric(event.currentTarget.value);
              if (!numeric) return;
              endScrub();
              let style = document.createElement("style");
              style.textContent =
                "html, html * { cursor: ew-resize !important; user-select: none !important; }";
              scrub = {
                pointerId: event.pointerId,
                originX: event.clientX,
                origin: numeric.value,
                digits: numeric.digits,
                dragging: false,
                style,
              };
              window.addEventListener("pointermove", moveScrub);
              window.addEventListener("pointerup", endScrub);
              window.addEventListener("pointercancel", endScrub);
            }),
          ]}
        />
        {color && (
          <input
            type="color"
            aria-label={`Color for ${name}`}
            value={color.rgb}
            mix={[
              colorPicker,
              on("input", (event) => {
                let rgb = event.currentTarget.value;
                object[name] = color.alpha ? `${rgb}${color.alpha}` : rgb;
              }),
            ]}
          />
        )}
        {bool && (
          <label
            mix={[
              iconButton,
              css({
                "&:has(:focus-visible)": {
                  background: "#333333",
                  outline: "1px solid currentColor",
                  outlineOffset: "1px",
                },
              }),
            ]}
          >
            <input
              type="checkbox"
              aria-label={`Boolean for ${name}`}
              checked={bool.checked}
              mix={[
                checkbox,
                on("input", (event) => {
                  object[name] = event.currentTarget.checked ? "true" : "false";
                }),
              ]}
            />
          </label>
        )}
        {file && (
          <label mix={[iconButton, fileControl]}>
            <Icon icon={File} size={14} />
            <input
              type="file"
              aria-label={`File for ${name}`}
              mix={[
                fileInput,
                on("change", (event) => {
                  let next = event.currentTarget.files?.[0];
                  if (!next) return;
                  if (file.startsWith("blob:")) URL.revokeObjectURL(file);
                  object[name] = URL.createObjectURL(next);
                }),
              ]}
            />
          </label>
        )}
        <button
          type="button"
          aria-label={`Delete ${name}`}
          mix={[
            iconButton,
            (file || color || bool) && css({ marginLeft: "-0.25rem" }),
            on("click", (event) => {
              event.stopPropagation();
              handle.props.onDelete();
            }),
          ]}
        >
          <Icon icon={Trash} size={14} />
        </button>
      </div>
    );
  };
}
