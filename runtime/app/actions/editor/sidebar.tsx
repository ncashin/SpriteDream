import ArrowLeft from "lucide/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide/dist/esm/icons/arrow-right.mjs";
import Box from "lucide/dist/esm/icons/box.mjs";
import Play from "lucide/dist/esm/icons/play.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { Mode, mode, setMode } from "../../utilities/mode.ts";
import { scene } from "../../utilities/scene.ts";
import { Search } from "./Search.tsx";
import { ObjectTree } from "./object-tree.tsx";

const SIDEBAR_WIDTH = "20rem";
const SIDEBAR_MOTION = "200ms ease";

export const Sidebar = clientEntry(import.meta.url, function Sidebar(handle: Handle) {
  let collapsed = false;

  return () => (
    <>
      <aside mix={panel} style={{ width: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
        <div id="scene-tree" inert={collapsed} mix={tree}>
          <ObjectTree object={scene} />
        </div>
      </aside>
      <header mix={bar} style={{ left: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="scene-tree"
          aria-label={collapsed ? "Expand scene tree" : "Collapse scene tree"}
          mix={[
            toggle,
            on("click", () => {
              collapsed = !collapsed;
              handle.update();
            }),
          ]}
        >
          <span>
            <Icon icon={Box} size={14} />
            <Icon icon={collapsed ? ArrowRight : ArrowLeft} size={14} />
          </span>
          <span
            mix={css({
              fontSize: "0.875rem",
              fontWeight: 400,
              lineHeight: "1.25rem",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            })}
          >
     
          
            SpriteDream
          </span>
        </button>
        <Search />
        <button
          type="button"
          aria-pressed={mode === Mode.Play}
          aria-label={mode === Mode.Play ? "Stop" : "Play"}
          mix={[
            control,
            on("click", () => {
              setMode(mode === Mode.Play ? Mode.Edit : Mode.Play);
              handle.update();
            }),
          ]}
        >
          {mode === Mode.Play ? "Stop" : "Play"}
          <Icon icon={mode === Mode.Play ? Square : Play} size={14} />
        </button>
      </header>
    </>
  );
});

const panel = css({
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  flex: "0 0 auto",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
  transition: `width ${SIDEBAR_MOTION}`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const tree = css({
  boxSizing: "border-box",
  borderRight: "1px solid #262626",
  flex: "1 0 auto",
  minHeight: 0,
  overflow: "auto",
  padding: "0.75rem 1rem 1rem",
  width: SIDEBAR_WIDTH,
});

const bar = css({
  alignItems: "flex-start",
  background: "transparent",
  color: "#f4f4f5",
  display: "flex",
  flexDirection: "row",
  gap: "0.75rem",
  minWidth: 0,
  padding: "0.75rem 1rem",
  pointerEvents: "none",
  position: "absolute",
  right: 0,
  top: 0,
  transition: `left ${SIDEBAR_MOTION}`,
  zIndex: 2,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const toggle = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "0.25rem",
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  flex: "0 1 auto",
  gap: "0.25rem",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0.25rem 0.5rem 0.25rem 0.375rem",
  pointerEvents: "auto",
  font: "inherit",
  "& > span:first-child": {
    display: "grid",
    flex: "0 0 auto",
  },
  "& > span:first-child > *": {
    gridArea: "1 / 1",
  },
  "& > span:first-child > :last-child": {
    visibility: "hidden",
  },
  "&:hover > span:first-child > :first-child": {
    visibility: "hidden",
  },
  "&:hover > span:first-child > :last-child": {
    visibility: "visible",
  },
  "&:hover": {
    background: "#262626",
  },
  "&:focus-visible": {
    background: "#262626",
    outline: "1px solid currentColor",
    outlineOffset: "1px",
  },
});

const control = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "0.25rem",
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  gap: "0.375rem",
  padding: "0.25rem 0.5rem",
  pointerEvents: "auto",
  font: "inherit",
  fontSize: "0.875rem",
  fontWeight: 400,
  lineHeight: "1.25rem",
  "&:hover": {
    background: "#262626",
  },
  "&:focus-visible": {
    background: "#262626",
    outline: "1px solid currentColor",
    outlineOffset: "1px",
  },
});
