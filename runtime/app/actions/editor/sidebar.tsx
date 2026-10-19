import ArrowLeft from "lucide/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide/dist/esm/icons/arrow-right.mjs";
import Play from "lucide/dist/esm/icons/play.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { Mode, mode, onModeChange } from "../../utilities/mode.ts";
import { currentSceneName, scene } from "../../utilities/scene.ts";
import { joinRoom } from "./room.tsx";
import { HierarchyTree } from "./hierarchy-tree.tsx";
import { ObjectSidebar } from "./object-sidebar.tsx";
import { syncMode } from "./room.tsx";
import { Search } from "./Search.tsx";

const SIDEBAR_WIDTH = "20rem";
const SIDEBAR_MOTION = "200ms ease";
const COLLAPSED_KEY = "sidebar-collapsed";

function readCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function releaseInitialCollapse() {
  const release = () => {
    const panels = document.querySelectorAll<HTMLElement>("[data-sidebar]");
    const ready = panels.length >= 1 && [...panels].every((panel) => panel.style.width === "0rem");
    if (!ready) {
      requestAnimationFrame(release);
      return;
    }
    delete document.documentElement.dataset.sidebarCollapsed;
  };
  requestAnimationFrame(release);
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export const Sidebar = clientEntry(import.meta.url, function Sidebar(handle: Handle) {
  let collapsed = readCollapsed();
  if (collapsed) releaseInitialCollapse();
  onModeChange(() => handle.update());
  let dirty = false;
  let name = currentSceneName();
  if (typeof window !== "undefined") {
    const room = joinRoom(handle.signal, {
      onDirtyChange(next) {
        if (dirty === next) return;
        dirty = next;
        handle.update();
      },
    });
    dirty = room.state.dirty;
  }
  if (typeof requestAnimationFrame === "function") {
    let frame = requestAnimationFrame(function tick() {
      if (handle.signal.aborted) return;
      const nextName = currentSceneName();
      if (nextName !== name) {
        name = nextName;
        handle.update();
      }
      frame = requestAnimationFrame(tick);
    });
    handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
  }

  return () => (
    <>
      <div data-sidebar="" mix={dock} style={{ width: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
        <aside inert={collapsed} mix={column}>
          <div id="scene-tree" mix={[tree, treeOuterPadding]}>
            <HierarchyTree object={scene} />
          </div>
        </aside>
        <ObjectSidebar collapsed={collapsed} />
      </div>
      <header data-sidebar-bar="" mix={bar} style={{ left: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="scene-tree object-view"
          aria-label={collapsed ? "Expand sidebars" : "Collapse sidebars"}
          mix={[
            toggle,
            on("click", () => {
              collapsed = !collapsed;
              writeCollapsed(collapsed);
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
              fontSize: "13px",
              fontWeight: 400,
              lineHeight: "1.25rem",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
            })}
          >
     
          
            {name}
            {dirty ? <span aria-label="Unsaved changes" title="Unsaved changes" mix={unsaved} /> : null}
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
              const next = mode === Mode.Play ? Mode.Edit : Mode.Play;
              syncMode(next);
              handle.update();
            }),
          ]}
        >
          <span mix={label}>
            <span style={{ visibility: mode === Mode.Play ? "hidden" : "visible" }}>Play</span>
            <span style={{ visibility: mode === Mode.Play ? "visible" : "hidden" }}>Stop</span>
          </span>
          <Icon icon={mode === Mode.Play ? Square : Play} size={14} />
        </button>
      </header>
    </>
  );
});

const dock = css({
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  flex: "0 0 auto",
  fontSize: "13px",
  lineHeight: 1.35,
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
  borderRight: "1px solid var(--line)",
  transition: `width ${SIDEBAR_MOTION}`,
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
});

const column = css({
  boxSizing: "border-box",
  borderBottom: "1px solid var(--line)",
  display: "flex",
  flex: "1 1 33.333%",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
});

const treeOuterPadding = css({
  padding: "0.875rem 0.625rem 1rem",
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
  color: "var(--text)",
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

const unsaved = css({
  background: "#f5a524",
  borderRadius: "999px",
  display: "inline-block",
  flex: "0 0 auto",
  height: "0.5rem",
  marginLeft: "0.4rem",
  width: "0.5rem",
});

const mark = css({
  display: "block",
  height: "32px",
  objectFit: "contain",
  width: "32px",
});

const toggle = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "0.25rem",
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "flex-start",
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
    background: "var(--hover)",
  },
  "&:focus-visible": {
    background: "var(--hover)",
    outline: "1px solid var(--line)",
    outlineOffset: "1px",
  },
});

const label = css({
  display: "grid",
  "& > span": {
    gridArea: "1 / 1",
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
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: 1.35,
  "&:hover": {
    background: "var(--hover)",
  },
  "&:focus-visible": {
    background: "var(--hover)",
    outline: "1px solid var(--line)",
    outlineOffset: "1px",
  },
});
