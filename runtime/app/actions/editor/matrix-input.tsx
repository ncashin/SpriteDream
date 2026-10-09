import ChevronDown from "lucide/dist/esm/icons/chevron-down.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import Move from "lucide/dist/esm/icons/move.mjs";
import Trash from "lucide/dist/esm/icons/trash.mjs";
import { css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";

type MatrixInputProps = {
  name: string;
  matrix: DOMMatrix;
  onDelete: () => void;
};

type Linear = {
  rotation: number;
  scaleX: number;
  scaleY: number;
};

const DRAG_SLOP = 4;
const POSITION_STEP = 1;
const ROTATION_STEP = 1;
const SCALE_STEP = 0.01;

type Field = "e" | "f" | "rotation" | "scaleX" | "scaleY";

export function MatrixInput(handle: Handle<MatrixInputProps>) {
  let collapsed = false;
  let linearHint: Linear | null = null;
  let focused: Field | null = null;
  let draft = "";
  let origin = 0;
  let scrub: {
    pointerId: number;
    originX: number;
    origin: number;
    step: number;
    dragging: boolean;
    style: HTMLStyleElement;
    apply: (value: number) => void;
  } | null = null;

  function currentLinear(matrix: DOMMatrix) {
    linearHint = closestLinear(matrix, linearHint);
    return linearHint;
  }

  function setPosition(axis: "e" | "f", value: number) {
    handle.props.matrix[axis] = value;
    handle.update();
  }

  function setLinear(patch: Partial<Linear>) {
    const matrix = handle.props.matrix;
    const next = { ...closestLinear(matrix, linearHint), ...patch };
    linearHint = next;
    const composed = new DOMMatrix().rotate(next.rotation).scale(next.scaleX, next.scaleY);
    matrix.a = composed.a;
    matrix.b = composed.b;
    matrix.c = composed.c;
    matrix.d = composed.d;
    handle.update();
  }

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
      focused = null;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    scrub.apply(scrub.origin + dx * scrub.step);
  }

  function startScrub(
    event: PointerEvent,
    value: number,
    step: number,
    apply: (value: number) => void,
  ) {
    if (event.button !== 0) return;
    endScrub();
    const style = document.createElement("style");
    style.textContent =
      "html, html * { cursor: ew-resize !important; user-select: none !important; }";
    scrub = {
      pointerId: event.pointerId,
      originX: event.clientX,
      origin: value,
      step,
      dragging: false,
      style,
      apply,
    };
    window.addEventListener("pointermove", moveScrub);
    window.addEventListener("pointerup", endScrub);
    window.addEventListener("pointercancel", endScrub);
  }

  handle.signal.addEventListener("abort", () => endScrub());

  return () => {
    const { name, matrix, onDelete } = handle.props;
    const linear = currentLinear(matrix);

    function numberInput(
      key: Field,
      ariaLabel: string,
      value: number,
      step: number,
      apply: (value: number) => void,
    ) {
      return (
        <input
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          value={focused === key ? draft : formatNumber(value)}
          mix={[
            field,
            on("focus", () => {
              focused = key;
              origin = value;
              draft = formatNumber(value);
              handle.update();
            }),
            on("input", (event) => {
              draft = event.currentTarget.value;
              const next = parseNumber(draft);
              if (next != null) apply(next);
              handle.update();
            }),
            on("blur", () => {
              if (focused === key) focused = null;
              handle.update();
            }),
            on("keydown", (event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key !== "Escape") return;
              apply(origin);
              focused = null;
              event.currentTarget.blur();
            }),
            on("pointerdown", (event) => startScrub(event, value, step, apply)),
          ]}
        />
      );
    }

    return (
      <>
        <div mix={row}>
          <div
            aria-expanded={!collapsed}
            mix={[
              disclosure,
              on("click", () => {
                collapsed = !collapsed;
                handle.update();
              }),
            ]}
          >
            <span mix={iconStack}>
              <Icon icon={Move} size={14} />
              <Icon icon={collapsed ? ChevronRight : ChevronDown} size={14} />
            </span>
            {name}
          </div>
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
            <Icon icon={Trash} size={14} />
          </button>
        </div>
        {collapsed ? null : (
          <div mix={css({ paddingLeft: "0.75rem" })}>
            <div mix={row}>
              <span mix={keyLabel}>
                Position<span aria-hidden="true">:</span>
              </span>
              {numberInput("e", `${name} position X`, matrix.e, POSITION_STEP, (value) =>
                setPosition("e", value),
              )}
              {numberInput("f", `${name} position Y`, matrix.f, POSITION_STEP, (value) =>
                setPosition("f", value),
              )}
            </div>
            <div mix={row}>
              <span mix={keyLabel}>
                Rotation<span aria-hidden="true">:</span>
              </span>
              {numberInput(
                "rotation",
                `${name} rotation`,
                linear.rotation,
                ROTATION_STEP,
                (value) => setLinear({ rotation: value }),
              )}
            </div>
            <div mix={row}>
              <span mix={keyLabel}>
                Scale<span aria-hidden="true">:</span>
              </span>
              {numberInput("scaleX", `${name} scale X`, linear.scaleX, SCALE_STEP, (value) =>
                setLinear({ scaleX: value }),
              )}
              {numberInput("scaleY", `${name} scale Y`, linear.scaleY, SCALE_STEP, (value) =>
                setLinear({ scaleY: value }),
              )}
            </div>
          </div>
        )}
      </>
    );
  };
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const text = String(Math.round(value * 1000) / 1000);
  return text === "-0" ? "0" : text;
}

function parseNumber(value: string) {
  const text = value.trim();
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function decomposeLinear(matrix: DOMMatrix): Linear {
  const scaleX = Math.hypot(matrix.a, matrix.b);
  const scaleYAbs = Math.hypot(matrix.c, matrix.d);
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const scaleY = determinant < 0 ? -scaleYAbs : scaleYAbs;
  let rotation = 0;
  if (scaleX > 1e-8) rotation = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  else if (scaleYAbs > 1e-8) rotation = (Math.atan2(-matrix.c, matrix.d) * 180) / Math.PI;
  return { rotation, scaleX, scaleY };
}

function flipLinear(linear: Linear): Linear {
  return {
    rotation: linear.rotation + 180,
    scaleX: -linear.scaleX,
    scaleY: -linear.scaleY,
  };
}

function shortestDelta(value: number, reference: number) {
  return ((((value - reference) % 360) + 540) % 360) - 180;
}

function alignRotation(linear: Linear, reference: number): Linear {
  return { ...linear, rotation: reference + shortestDelta(linear.rotation, reference) };
}

function linearDistance(linear: Linear, hint: Linear) {
  return (
    Math.abs(shortestDelta(linear.rotation, hint.rotation)) +
    Math.abs(linear.scaleX - hint.scaleX) +
    Math.abs(linear.scaleY - hint.scaleY)
  );
}

function closestLinear(matrix: DOMMatrix, hint: Linear | null): Linear {
  const primary = decomposeLinear(matrix);
  if (!hint) return primary;
  const aligned = alignRotation(primary, hint.rotation);
  const flipped = alignRotation(flipLinear(primary), hint.rotation);
  return linearDistance(flipped, hint) < linearDistance(aligned, hint) ? flipped : aligned;
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
  "& > button": {
    visibility: "hidden",
  },
  "&:hover > button": {
    visibility: "visible",
  },
});

const disclosure = css({
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
});

const iconStack = css({
  display: "grid",
  "& > *": { gridArea: "1 / 1" },
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

const keyLabel = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flex: "0 0 auto",
  color: "var(--text-light)",
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
  flex: "0 0 auto",
  fieldSizing: "content",
  font: "inherit",
  lineHeight: "inherit",
  margin: 0,
  maxWidth: "100%",
  minWidth: 0,
  outline: "none",
  padding: 0,
  width: "auto",
  "&:focus, &:focus-visible": {
    outline: "none",
  },
});
