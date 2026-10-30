import ArrowLeft from "lucide/dist/esm/icons/arrow-left.mjs";
import ArrowRight from "lucide/dist/esm/icons/arrow-right.mjs";
import { clientEntry, css, on, ref } from "remix/component";
import type { Handle } from "remix/component";

import { Icon } from "../../../icon.tsx";
import { Mode, mode, onModeChange, setMode } from "../../../utilities/mode.ts";
import { blinkPhase, blinkScale, clampGaze, faceFor, GAZE_LOOK, gazePivot, gazePivotBack } from "./blobs.tsx";
import { Button } from "./button.tsx";
import { joinRoom } from "../../../../room/room.tsx";
import { roomMessage } from "../../../../room/protocol.ts";
import { Search } from "./Search.tsx";

export const Header = clientEntry(import.meta.url, function Header(handle: Handle) {
  let collapsed = false;
  if (typeof window !== "undefined") {
    window.addEventListener(
      "toggle-sidebars",
      () => {
        collapsed = !collapsed;
        handle.update();
      },
      { signal: handle.signal },
    );
  }
  onModeChange(() => handle.update(), handle.signal);
  let dirty = false;
  let you = "";
  let name = "";
  let stack: HTMLElement | undefined;
  let aimX = 0;
  let aimY = 0;
  let driftX = 0;
  let driftY = 0;
  let lookX = 0;
  let lookY = 0;
  let tracking = false;
  let phase = blinkPhase(you);
  if (typeof window !== "undefined") {
    void joinRoom(handle.signal, roomMessage)
      .then((room) => {
        if (handle.signal.aborted) return;
        you = room.you.id;
        phase = blinkPhase(you);
        handle.update();
      })
      .catch(() => {});
  }
  if (typeof requestAnimationFrame === "function") {
    window.addEventListener(
      "pointermove",
      (event) => {
        lookX = event.clientX;
        lookY = event.clientY;
        tracking = true;
      },
      { signal: handle.signal },
    );
    let frame = requestAnimationFrame(function tick() {
      if (handle.signal.aborted) return;
      const gaze = stack?.querySelector("[data-gaze]");
      if (gaze instanceof SVGElement) {
        const box = gaze.ownerSVGElement?.getBoundingClientRect();
        if (tracking && box && box.width > 0) {
          const scale = 100 / box.width;
          const aim = clampGaze(
            (lookX - (box.left + box.width / 2)) * scale,
            (lookY - (box.top + box.height / 2)) * scale,
            GAZE_LOOK,
          );
          driftX = aim.x;
          driftY = aim.y;
        } else {
          driftX *= 0.994;
          driftY *= 0.994;
        }
        const follow = driftY < aimY ? 0.28 : 0.08;
        aimX += (driftX - aimX) * follow;
        aimY += (driftY - aimY) * follow;
        const blink = blinkScale(performance.now() / 1000, phase);
        gaze.setAttribute(
          "transform",
          `translate(${aimX.toFixed(2)} ${aimY.toFixed(2)}) ${gazePivot} scale(1 ${blink.toFixed(3)}) ${gazePivotBack}`,
        );
      }
      frame = requestAnimationFrame(tick);
    });
    handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
  }

  return () => {
    const playing = mode === Mode.Play;
    return (
    <div mix={shell}>
      <div mix={editorChrome}>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls="scene-tree object-view"
        aria-label={collapsed ? "Expand sidebars" : "Collapse sidebars"}
        mix={[
          toggle,
          on("click", () => {
            window.dispatchEvent(new Event("toggle-sidebars"));
          }),
        ]}
      >
        <span mix={[markStack, ref((element) => { stack = element; })]}>
          {you ? faceFor(you) : null}
          <Icon icon={collapsed ? ArrowRight : ArrowLeft} size={18} />
        </span>
      </button>
    <header mix={bar}>
      <div mix={titleSlot}>
        <span mix={sceneName}>
          <span mix={sceneTitle}>{name}</span>
          <span
            aria-hidden={dirty ? undefined : true}
            mix={[unsaved, !dirty && unsavedHidden]}
          >
            Unsaved
          </span>
        </span>
      </div>
      <Search />
      <div mix={actions}>
        <span aria-hidden="true" mix={playSpacer}>
          <Button size="field" mix={playButton}>
            <PlayLabel playing={false} />
          </Button>
        </span>
      </div>
    </header>
      </div>
      <div mix={playSlot}>
      <Button
        size="field"
        mix={playButton}
        pressed={playing}
        label={playing ? "Stop" : "Play"}
        onClick={() => {
          setMode(playing ? Mode.Edit : Mode.Play);
          handle.update();
        }}
      >
        <PlayLabel playing={playing} />
      </Button>
      </div>
    </div>
    );
  };
});

function PlayLabel(handle: Handle<{ playing: boolean }>) {
  return () => {
    const { playing } = handle.props;
    return (
      <span mix={label}>
        <span aria-hidden="true" mix={sizer}>
          Stop
          <svg viewBox="0 0 12 12" mix={glyph}>
            <path d="M1.6 1.6h8.8v8.8H1.6Z" fill="currentColor" />
          </svg>
        </span>
        <span style={{ visibility: playing ? "hidden" : "visible" }}>
          Play
          <svg viewBox="0 0 12 12" aria-hidden="true" mix={glyph}>
            <path d="M1.7 1 11 6 1.7 11Z" fill="currentColor" />
          </svg>
        </span>
        <span style={{ visibility: playing ? "visible" : "hidden" }}>
          Stop
          <svg viewBox="0 0 12 12" aria-hidden="true" mix={glyph}>
            <path d="M1.6 1.6h8.8v8.8H1.6Z" fill="currentColor" />
          </svg>
        </span>
      </span>
    );
  };
}

const editorChrome = css({
  alignItems: "flex-start",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "row",
  minWidth: 0,
});

const playSpacer = css({
  visibility: "hidden",
});

const playSlot = css({
  pointerEvents: "auto",
  position: "absolute",
  right: "1rem",
  top: "calc(0.8rem + 0.05rem)",
  zIndex: 3,
});

const shell = css({
  alignItems: "flex-start",
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-start",
  left: 0,
  paddingTop: "0.8rem",
  pointerEvents: "none",
  position: "absolute",
  right: 0,
  top: 0,
  zIndex: 2,
});

const bar = css({
  alignItems: "flex-start",
  background: "transparent",
  color: "var(--text)",
  containerName: "header-bar",
  containerType: "inline-size",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "row",
  justifyContent: "space-between",
  gap: "0.5rem",
  minWidth: 0,
  padding: "0.05rem 1rem 0.05rem 0",
  pointerEvents: "none",
});

const titleSlot = css({
  alignItems: "center",
  display: "flex",
  flex: "1 1 0",
  minWidth: 0,
});

const actions = css({
  alignItems: "center",
  display: "flex",
  flex: "1 1 0",
  flexDirection: "row",
  gap: "0.35rem",
  justifyContent: "flex-end",
  minWidth: 0,
});

const playButton = css({
  background: "var(--hover)",
  backdropFilter: "blur(12px)",
  borderRadius: "6px",
  fontWeight: 450,
  marginLeft: 0,
  padding: "0.25em 0.5em 0.25em 0.65em",
  "&:hover, &:focus, &:focus-visible, &:active, &[aria-pressed='true']": {
    background: "var(--hover)",
  },
});

const unsaved = css({
  color: "color-mix(in srgb, var(--text) 55%, transparent)",
  fontSize: "11px",
  fontWeight: 450,
  left: 0,
  letterSpacing: "-0.006em",
  lineHeight: 1.2,
  position: "absolute",
  top: "100%",
});

const unsavedHidden = css({
  visibility: "hidden",
});

const sceneName = css({
  color: "var(--text)",
  display: "inline-flex",
  font: "inherit",
  maxWidth: "100%",
  minWidth: 0,
  paddingTop: "0.1rem",
  pointerEvents: "none",
  position: "relative",
});

const sceneTitle = css({
  fontSize: "13px",
  fontWeight: 450,
  letterSpacing: "-0.011em",
  lineHeight: 1.35,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const markStack = css({
  display: "block",
  height: "100%",
  position: "relative",
  width: "100%",
  "& svg": {
    display: "block",
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
  },
});

const toggle = css({
  appearance: "none",
  background: "transparent",
  border: "none",
  borderRadius: "0.45rem",
  boxSizing: "border-box",
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  height: "2.25rem",
  margin: "-0.2rem 0.35rem 0.3rem 0.5rem",
  padding: 0,
  pointerEvents: "auto",
  position: "relative",
  width: "2.25rem",
  zIndex: 3,
  "& span > :last-child": {
    visibility: "hidden",
  },
  "&:hover, &:focus-visible": {
    background: "var(--hover)",
  },
  "&:hover span > :first-child, &:focus-visible span > :first-child": {
    visibility: "hidden",
  },
  "&:hover span > :last-child, &:focus-visible span > :last-child": {
    visibility: "visible",
  },
});

const glyph = css({
  display: "block",
  flex: "0 0 auto",
  height: "12px",
  width: "12px",
});

const label = css({
  display: "inline-grid",
  "& > span": {
    alignItems: "center",
    display: "inline-flex",
    gap: "0.35em",
    gridArea: "1 / 1",
    justifyContent: "center",
  },
});

const sizer = css({
  visibility: "hidden",
});
