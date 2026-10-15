import ArrowLeft from "lucide/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide/dist/esm/icons/arrow-right.mjs";
import Play from "lucide/dist/esm/icons/play.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { Mode, mode, setMode } from "../../utilities/mode.ts";
import { scene } from "../../utilities/scene.ts";
import { HierarchyTree } from "./hierarchy-tree.tsx";
import { ObjectSidebar, OBJECT_SIDEBAR_WIDTH } from "./object-sidebar.tsx";
import { Search } from "./Search.tsx";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_MOTION = "200ms ease";

export const Sidebar = clientEntry(import.meta.url, function Sidebar(handle: Handle) {
  let collapsed = false;

  return () => (
    <>
      <aside mix={panel} style={{ width: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
        <div inert={collapsed} mix={column}>
          <h2 mix={heading}>Scene Tree</h2>
          <div id="scene-tree" mix={[tree, treeOuterPadding]}>
            <HierarchyTree object={scene} />
          </div>
        </div>
      </aside>
      <ObjectSidebar collapsed={collapsed} />
      <header mix={bar} style={{ left: collapsed ? "0rem" : `calc(${SIDEBAR_WIDTH} + ${OBJECT_SIDEBAR_WIDTH})` }}>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="scene-tree object-view"
          aria-label={collapsed ? "Expand sidebars" : "Collapse sidebars"}
          mix={[
            toggle,
            on("click", () => {
              collapsed = !collapsed;
              handle.update();
            }),
          ]}
        >
          <span>
            <img src="/favicon.svg" alt="" mix={mark} />
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

const column = css({
  boxSizing: "border-box",
  borderRight: "1px solid #262626",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  minHeight: 0,
  width: SIDEBAR_WIDTH,
});

const heading = css({
  color: "#f4f4f5",
  flex: "0 0 auto",
  fontSize: "0.875rem",
  fontWeight: 400,
  lineHeight: "1.25rem",
  margin: 0,
  padding: "1rem 1rem 0.25rem",
});

const treeOuterPadding = css({
  padding: "0.25rem 0.625rem 1rem",
});

const tree = css({
  boxSizing: "border-box",
  flex: "1 1 0",
  minHeight: 0,
  overflow: "auto",
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
  transition: `left ${SIDEBAR_MOTION}, right ${SIDEBAR_MOTION}`,
  zIndex: 2,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const mark = css({
  display: "block",
  height: "22px",
  objectFit: "contain",
  width: "22px",
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
    placeItems: "center",
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
