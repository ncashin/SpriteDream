import Blend from "lucide/dist/esm/icons/blend.mjs";
import { css, on, ref } from "remix/component";
import type { Handle } from "remix/component";

import { Dropdown } from "../dropdown.tsx";
import { blendDefaults, blendModes, blendParams, type BlendMode, type BlendParam } from "./blend.ts";

const DRAG_SLOP = 4;
const DRAG_STEP = 0.01;

type BlendOptionsProps = {
  mode: BlendMode;
  params: number[];
  onMode: (mode: BlendMode) => void;
  onParam: (index: number, value: number) => void;
};

export function BlendOptions(handle: Handle<BlendOptionsProps>) {
  return () => {
    const { mode, params, onMode, onParam } = handle.props;
    return (
      <span mix={options}>
        <Dropdown
          label="Blend"
          text={mode}
          icon={Blend}
          items={blendModes.map((item) => ({
            label: item,
            onSelect() {
              onMode(item);
            },
          }))}
        />
        {blendParams[mode].map((param, index) => {
          const value = params[index] ?? blendDefaults[mode][index] ?? 0;
          return param.labels ? (
            <EaseParam key={param.name} param={param} value={value} onChange={(next) => onParam(index, next)} />
          ) : (
            <BlendParam key={param.name} param={param} value={value} onChange={(next) => onParam(index, next)} />
          );
        })}
      </span>
    );
  };
}

function EaseParam(handle: Handle<{ param: BlendParam; value: number; onChange: (value: number) => void }>) {
  let open = false;
  let button: HTMLButtonElement | null = null;
  let menu: HTMLElement | null = null;

  function place() {
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const margin = 4;
    let top = rect.bottom + margin;
    if (top + menu.offsetHeight > window.innerHeight - margin) top = Math.max(margin, rect.top - margin - menu.offsetHeight);
    let left = rect.left;
    if (left + menu.offsetWidth > window.innerWidth - margin) left = window.innerWidth - margin - menu.offsetWidth;
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(margin, left)}px`;
  }

  return () => {
    const { param, value, onChange } = handle.props;
    const labels = param.labels ?? [];
    const current = labels[Math.round(value)] ?? labels[0] ?? "";
    return (
      <>
        <button
          type="button"
          aria-label={param.name}
          aria-haspopup="menu"
          aria-expanded={open}
          mix={[
            paramRow,
            easeButton,
            ref((node) => {
              button = node instanceof HTMLButtonElement ? node : null;
            }),
            on("pointerdown", (event) => {
              event.stopPropagation();
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
          <span mix={paramName}>{param.name}</span>
          <span>{current}</span>
        </button>
        <div
          popover="auto"
          role="menu"
          mix={[
            easeMenu,
            ref((node) => {
              menu = node instanceof HTMLElement ? node : null;
            }),
            on("pointerdown", (event) => {
              event.stopPropagation();
            }),
            on("toggle", (event) => {
              const currentMenu = menu;
              if (!(event instanceof ToggleEvent) || !currentMenu || event.target !== currentMenu) return;
              const next = event.newState === "open";
              if (next) place();
              if (open === next) return;
              open = next;
              handle.update();
            }),
          ]}
        >
          {labels.map((label, index) => (
            <button
              type="button"
              role="menuitem"
              key={label}
              mix={[easeItem, index === Math.round(value) ? easeItemCurrent : null, on("click", (event) => {
                event.stopPropagation();
                menu?.hidePopover();
                if (index !== Math.round(value)) onChange(index);
              })]}
            >
              {label}
            </button>
          ))}
        </div>
      </>
    );
  };
}

function BlendParam(handle: Handle<{ param: BlendParam; value: number; onChange: (value: number) => void }>) {
  let saved = formatParam(handle.props.value, handle.props.param);
  let draft = saved;
  let focused = false;
  let scrub: {
    pointerId: number;
    originX: number;
    lastX: number;
    value: number;
    dragging: boolean;
    style: HTMLStyleElement;
  } | null = null;

  function clamp(value: number) {
    const { min, max, step } = handle.props.param;
    const bounded = Math.min(max, Math.max(min, value));
    return step ? Math.round(bounded / step) * step : bounded;
  }

  function commit(next: string) {
    const numeric = parseParam(next, handle.props.param);
    if (numeric == null) {
      draft = saved;
      handle.update();
      return;
    }
    const bounded = clamp(numeric);
    saved = formatParam(bounded, handle.props.param);
    draft = saved;
    if (bounded !== handle.props.value) handle.props.onChange(bounded);
    else handle.update();
  }

  function endScrub(event?: PointerEvent) {
    if (!scrub || (event && event.pointerId !== scrub.pointerId)) return;
    window.removeEventListener("pointermove", moveScrub);
    window.removeEventListener("pointerup", endScrub);
    window.removeEventListener("pointercancel", endScrub);
    scrub.style.remove();
    if (scrub.dragging) commit(draft);
    scrub = null;
  }

  function dragScale(value: number, direction: number) {
    const span = handle.props.param.max - handle.props.param.min;
    if (span <= 0 || direction === 0) return 1;
    const room = direction > 0 ? handle.props.param.max - value : value - handle.props.param.min;
    const influence = span * 0.35;
    if (room >= influence) return 1;
    const proximity = Math.max(0, room / influence);
    return proximity * proximity;
  }

  function moveScrub(event: PointerEvent) {
    if (!scrub || event.pointerId !== scrub.pointerId) return;
    let dx = event.clientX - scrub.originX;
    if (!scrub.dragging) {
      if (Math.abs(dx) <= DRAG_SLOP) return;
      scrub.dragging = true;
      scrub.originX += Math.sign(dx) * DRAG_SLOP;
      scrub.lastX = scrub.originX;
      document.head.append(scrub.style);
      window.getSelection()?.removeAllRanges();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    const step = event.clientX - scrub.lastX;
    scrub.lastX = event.clientX;
    const unit = handle.props.param.step ?? DRAG_STEP;
    const pixels = handle.props.param.step ? 12 : 1;
    scrub.value = clamp(scrub.value + (step / pixels) * unit * dragScale(scrub.value, step));
    draft = formatParam(scrub.value, handle.props.param);
    const numeric = parseParam(draft, handle.props.param);
    if (numeric != null) handle.props.onChange(numeric);
    else handle.update();
  }

  handle.signal.addEventListener("abort", () => endScrub());

  return () => {
    const shown = formatParam(handle.props.value, handle.props.param);
    if (!scrub && !focused && shown !== saved) {
      saved = shown;
      draft = shown;
    }
    return (
      <span
        mix={[
          paramRow,
          on("pointerdown", (event) => {
            event.stopPropagation();
            if (event.button !== 0) return;
            const numeric = parseParam(draft, handle.props.param);
            if (numeric == null) return;
            endScrub();
            const style = document.createElement("style");
            style.textContent = "html, html * { cursor: ew-resize !important; user-select: none !important; }";
            scrub = {
              pointerId: event.pointerId,
              originX: event.clientX,
              lastX: event.clientX,
              value: numeric,
              dragging: false,
              style,
            };
            window.addEventListener("pointermove", moveScrub);
            window.addEventListener("pointerup", endScrub);
            window.addEventListener("pointercancel", endScrub);
          }),
        ]}
      >
        <span mix={paramName}>{handle.props.param.name}</span>
        <input
          type="text"
          inputMode="decimal"
          min={handle.props.param.min}
          max={handle.props.param.max}
          aria-label={handle.props.param.name}
          autocomplete="off"
          spellcheck={false}
          value={draft}
          mix={[
            paramField,
            on("click", (event) => {
              event.stopPropagation();
            }),
            on("focus", (event) => {
              focused = true;
              event.currentTarget.select();
            }),
            on("input", (event) => {
              draft = event.currentTarget.value;
              handle.update();
            }),
            on("blur", () => {
              focused = false;
              if (scrub?.dragging) return;
              commit(draft);
            }),
            on("keydown", (event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key !== "Escape") return;
              draft = saved;
              handle.update();
              event.currentTarget.blur();
            }),
          ]}
        />
      </span>
    );
  };
}

function formatParam(value: number, param: BlendParam) {
  const label = param.labels?.[Math.round(value)];
  if (label && param.step) return label;
  if (!Number.isFinite(value)) return "0";
  const text = String(Math.round(value * 1000) / 1000);
  return text === "-0" ? "0" : text;
}

function parseParam(value: string, param: BlendParam) {
  const text = value.trim().toLowerCase();
  const labeled = param.labels?.findIndex((label) => label === text);
  if (labeled != null && labeled >= 0) return labeled;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

const options = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
  userSelect: "text",
  "& button": {
    marginLeft: 0,
  },
});

const paramRow = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
  maxHeight: "1.25rem",
  boxSizing: "border-box",
  padding: "0.3em 0.5em",
  borderRadius: "0.6em",
  fontSize: "10px",
  fontWeight: 500,
  lineHeight: 1.35,
  cursor: "ew-resize",
  "&:hover": {
    background: "var(--hover)",
  },
  "&:focus-within": {
    cursor: "text",
  },
});

const easeButton = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
});

const easeMenu = css({
  background: "var(--menu)",
  border: "1px solid transparent",
  borderRadius: "10px",
  boxShadow: "0 4px 42px #0006, 0 0 0 1px #ffffff14",
  color: "var(--text)",
  flexDirection: "column",
  inset: "auto",
  margin: 0,
  minWidth: "5.5rem",
  padding: "0.25rem",
  position: "fixed",
  "&:popover-open": {
    display: "flex",
  },
});

const easeItem = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "6px",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  fontSize: "13px",
  lineHeight: 1.35,
  padding: "0.25rem 0.5rem",
  textAlign: "left",
  "&:hover, &:focus-visible": {
    background: "var(--hover)",
    outline: "none",
  },
});

const easeItemCurrent = css({
  background: "var(--hover)",
});

const paramName = css({
  color: "var(--text-muted)",
  flex: "0 0 auto",
  pointerEvents: "none",
});

const paramField = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: 0,
  boxShadow: "none",
  boxSizing: "border-box",
  color: "inherit",
  display: "block",
  fieldSizing: "content",
  flex: "0 0 auto",
  font: "inherit",
  lineHeight: "inherit",
  margin: 0,
  minWidth: "1ch",
  outline: "none",
  padding: 0,
  width: "auto",
  userSelect: "text",
  cursor: "text",
  "&:focus, &:focus-visible": {
    outline: "none",
  },
});
