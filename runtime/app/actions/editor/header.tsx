import ArrowLeft from "lucide/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide/dist/esm/icons/arrow-right.mjs";
import Play from "lucide/dist/esm/icons/play.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../icon.tsx";
import { Mode, mode, onModeChange } from "../../utilities/mode.ts";
import { currentSceneName } from "../../utilities/scene.ts";
import { Button } from "./button.tsx";
import { isCollapsed, onCollapsedChange, setCollapsed, SIDEBAR_MOTION, SIDEBAR_WIDTH } from "./collapsed.ts";
import { joinRoom, syncMode } from "./room.tsx";
import { Search } from "./Search.tsx";

export const Header = clientEntry(import.meta.url, function Header(handle: Handle) {
  let collapsed = isCollapsed();
  onCollapsedChange(() => {
    collapsed = isCollapsed();
    handle.update();
  }, handle.signal);
  onModeChange(() => handle.update(), handle.signal);
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
    <div data-sidebar-bar="" mix={shell} style={{ left: collapsed ? "0rem" : SIDEBAR_WIDTH }}>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls="scene-tree object-view"
        aria-label={collapsed ? "Expand sidebars" : "Collapse sidebars"}
        mix={[
          toggle,
          on("click", () => {
            setCollapsed(!collapsed);
          }),
        ]}
      >
        <Icon icon={collapsed ? ArrowRight : ArrowLeft} size={14} />
      </button>
    <header mix={bar}>
      <span mix={identity}>
        <span mix={sceneName}>
          {name}
          {dirty ? <span aria-label="Unsaved changes" title="Unsaved changes" mix={unsaved} /> : null}
        </span>
      </span>
      <Search />
      <Button
        size="field"
        pressed={mode === Mode.Play}
        label={mode === Mode.Play ? "Stop" : "Play"}
        onClick={() => {
          const next = mode === Mode.Play ? Mode.Edit : Mode.Play;
          syncMode(next);
          handle.update();
        }}
      >
        <span mix={label}>
          <span style={{ visibility: mode === Mode.Play ? "hidden" : "visible" }}>Play</span>
          <span style={{ visibility: mode === Mode.Play ? "visible" : "hidden" }}>Stop</span>
        </span>
        <Icon icon={mode === Mode.Play ? Square : Play} size={14} />
      </Button>
    </header>
    </div>
  );
});

const shell = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-start",
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

const bar = css({
  alignItems: "center",
  background: "transparent",
  color: "var(--text)",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "row",
  gap: "0.75rem",
  justifyContent: "space-between",
  minWidth: 0,
  padding: "0.75rem 1rem 0.75rem 0",
  pointerEvents: "none",
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

const identity = css({
  alignItems: "center",
  display: "inline-flex",
  flex: "0 1 auto",
  gap: "0.25rem",
  maxWidth: "100%",
  minWidth: 0,
  pointerEvents: "none",
});

const sceneName = css({
  fontSize: "13px",
  fontWeight: 400,
  lineHeight: "1.25rem",
  minWidth: 0,
  overflow: "hidden",
  pointerEvents: "auto",
  textOverflow: "ellipsis",
});

const toggle = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "0.6em",
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  margin: "0 0 0 1rem",
  padding: "0.45em",
  pointerEvents: "auto",
  font: "inherit",
  fontSize: "13px",
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

const label = css({
  display: "grid",
  "& > span": {
    gridArea: "1 / 1",
  },
});
