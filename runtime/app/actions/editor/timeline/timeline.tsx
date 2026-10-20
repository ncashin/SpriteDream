import ChevronDown from "lucide/dist/esm/icons/chevron-down.mjs";
import ChevronUp from "lucide/dist/esm/icons/chevron-up.mjs";
import Clapperboard from "lucide/dist/esm/icons/clapperboard.mjs";
import { clientEntry, css, on } from "remix/component";
import type { Handle } from "remix/component";
import { hotkeys } from "../../../utilities/hotkey.ts";
import { applyScenePatch, type ScenePatch } from "../../../utilities/scene.ts";
import { Icon } from "../../../icon.tsx";
import { isTimelineCollapsed, onTimelineCollapsedChange, setTimelineCollapsed } from "./collapsed.ts";
import { joinRoom } from "../room.tsx";
import { blendAt, blendDefaults, type Keyframe } from "./blend.ts";
import { BlendLine } from "./BlendLine.tsx";
import { BlendOptions } from "./BlendOptions.tsx";
import { KeyFrame, type KeyFrameType } from "./KeyFrame.tsx";

const seconds = 8;

const honk = {
  src: "/sounds/freddys-honk-nose.mp3",
  duration: 0.497,
  peaks: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0.008, 0.02, 0.12, 0.401, 0.401, 0.387, 0.402, 0.439, 0.504, 0.502, 0.527, 0.531,
    0.525, 0.535, 0.525, 0.533, 0.509, 0.488, 0.468, 0.473, 0.462, 0.472, 0.484, 0.49, 0.497, 0.474, 0.415, 0.415,
    0.412, 0.335, 0.355, 0.348, 0.32, 0.278, 0.271, 0.264, 0.232, 0.208, 0.186, 0.176, 0.165, 0.163, 0.161, 0.172,
    0.167, 0.132, 0.081, 0.044, 0.027, 0.014, 0.006, 0.003, 0, 0,
  ],
};

const animationTracks: { path: string; type?: KeyFrameType; keyframes: Keyframe[] }[] = [
  {
    path: "TestImage.image.tint",
    keyframes: [
      { time: 0, value: "#f4f4f5ff", blend: "linear", params: [] },
      { time: 2, value: "#f43f5eff", blend: "lerp", params: [2, 2] },
    ],
  },
  {
    path: "TestImage.transform",
    keyframes: [
      { time: 0, value: "matrix(1, 0, 0, 1, 180, 221)", blend: "linear", params: [] },
      { time: 2, value: "matrix(1, 0, 0, 1, 820, 221)", blend: "slerp", params: [1, 0, 0] },
    ],
  },
  {
    path: "Audio",
    type: "sound",
    keyframes: [{ time: 1, value: honk.src, blend: "none", params: [] }],
  },
];

function keyFrameType(item: { path: string; type?: KeyFrameType }): KeyFrameType {
  if (item.type) return item.type;
  return item.path.endsWith(".transform") ? "transform" : "color";
}

function samplePatch(time: number): ScenePatch {
  return animationTracks.flatMap((item) => {
    const type = keyFrameType(item);
    if (type === "sound") return [];
    return [{ path: item.path.split("."), value: blendAt(type, item.keyframes, time) }];
  });
}

let honkAudio: HTMLAudioElement | undefined;

function playHonk() {
  if (typeof Audio !== "function") return;
  honkAudio ??= new Audio(honk.src);
  honkAudio.currentTime = 0;
  void honkAudio.play();
}

function cueSounds(from: number, to: number) {
  if (typeof window === "undefined") return;
  for (const item of animationTracks) {
    if (keyFrameType(item) !== "sound") continue;
    for (const frame of item.keyframes) {
      if (frame.time > from && frame.time <= to && frame.value === honk.src) playHonk();
    }
  }
}

export const Timeline = clientEntry(import.meta.url, function Timeline(handle: Handle) {
  let time = 0;
  let applied = "";
  let scrubbing = false;
  let playing = false;
  let collapsed = isTimelineCollapsed();
  onTimelineCollapsedChange(() => {
    collapsed = isTimelineCollapsed();
    handle.update();
  }, handle.signal);
  let lastStamp = 0;
  let frame = 0;
  const room = typeof window !== "undefined" ? joinRoom(handle.signal) : undefined;

  function stopPlayback() {
    playing = false;
    lastStamp = 0;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function advance(now: number) {
    if (handle.signal.aborted || !playing) return;
    const delta = lastStamp === 0 ? 0 : (now - lastStamp) / 1000;
    lastStamp = now;
    const next = time + delta;
    const reached = Math.min(seconds, next);
    cueSounds(time, reached);
    if (next >= seconds) {
      time = seconds;
      stopPlayback();
    } else {
      time = next;
      frame = requestAnimationFrame(advance);
    }
    publish();
    handle.update();
  }

  function play() {
    if (typeof requestAnimationFrame !== "function") return;
    if (time >= seconds) time = 0;
    playing = true;
    lastStamp = 0;
    frame = requestAnimationFrame(advance);
    handle.update();
  }

  handle.signal.addEventListener("abort", stopPlayback);

  hotkeys(
    {
      space: (event) => {
        event.preventDefault();
        if (playing) {
          stopPlayback();
          handle.update();
          return;
        }
        play();
      },
    },
    { signal: handle.signal },
  );

  function publish() {
    const patch = samplePatch(time);
    const encoded = JSON.stringify(patch);
    if (encoded === applied) return;
    applyScenePatch(patch);
    if (!room || room.socket.readyState !== WebSocket.OPEN) return;
    room.sendScenePatch(patch);
    applied = encoded;
  }

  publish();
  if (typeof requestAnimationFrame === "function") {
    let frame = requestAnimationFrame(function tick() {
      if (handle.signal.aborted) return;
      publish();
      if (applied === "") frame = requestAnimationFrame(tick);
    });
    handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
  }

  function laneOf(sheet: EventTarget | null) {
    const lane = sheet instanceof HTMLElement ? sheet.querySelector("[data-lane]") : null;
    return lane instanceof HTMLElement ? lane : null;
  }

  function overLane(clientX: number, lane: Element) {
    const rect = lane.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right;
  }

  function seek(clientX: number, lane: HTMLElement) {
    const rect = lane.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
    time = Math.min(seconds, Math.max(0, ratio * seconds));
    stopPlayback();
    publish();
    handle.update();
  }

  function timeAt(clientX: number, track: HTMLElement) {
    const lane = track.parentElement?.querySelector("[data-lane]");
    if (!(lane instanceof HTMLElement)) return 0;
    const rect = lane.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
    return Math.min(seconds, Math.max(0, ratio * seconds));
  }

  return () => (
    <div mix={[timeline, collapsed && timelineCollapsed]}>
      {false && <header>
        <Icon icon={Clapperboard} size={12} />
        Animation Name
      </header>}
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls="animation-sheet"
        aria-label={collapsed ? "Show animation" : "Hide animation"}
        mix={[
          hideToggle,
          collapsed && hideToggleCollapsed,
          on("click", () => {
            setTimelineCollapsed(!isTimelineCollapsed());
          }),
        ]}
      >
        <span mix={markStack}>
          <span>Animation</span>
          <Icon icon={collapsed ? ChevronUp : ChevronDown} size={18} />
        </span>
      </button>
      {collapsed ? null : <div
        id="animation-sheet"
        mix={[
          sheet,
          scrubbing && scrub,
          on("pointerdown", (event) => {
            if (event.button !== 0) return;
            const sheet = event.currentTarget;
            const lane = laneOf(sheet);
            if (!(sheet instanceof HTMLElement) || !lane || !overLane(event.clientX, lane)) return;
            event.preventDefault();
            scrubbing = true;
            const move = (moveEvent: PointerEvent) => {
              const current = lane.isConnected ? lane : laneOf(sheet);
              if (current) seek(moveEvent.clientX, current);
            };
            const end = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", end);
              window.removeEventListener("pointercancel", end);
              scrubbing = false;
              handle.update();
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", end);
            window.addEventListener("pointercancel", end);
            seek(event.clientX, lane);
          }),
        ]}
      >
        <div mix={rulerRow} />
        <div mix={lanes} data-lane="">
          {Array.from({ length: seconds + 1 }, (_, second) => (
            <div key={second} mix={tick} style={{ left: `${(second / seconds) * 100}%` }}>
              <span>{second}s</span>
            </div>
          ))}
        </div>
        {animationTracks.map((item) => {
          const type = keyFrameType(item);
          return (
            <div key={item.path} mix={[track, scrubbing && quietHover]}>
            <div mix={[trackName, scrubbing && quietHover]}>
              {type !== "sound" && <KeyFrame type={type} value={blendAt(type, item.keyframes, time)} />}
              {item.path}
            </div>
            {type === "sound" &&
              item.keyframes.map((frame) =>
                frame.value === honk.src ? (
                  <span
                    key={frame.time}
                    mix={[
                      waveform,
                      on("pointerdown", (event) => {
                        if (event.button !== 0) return;
                        event.stopPropagation();
                        event.preventDefault();
                        const track = event.currentTarget.parentElement;
                        if (!(track instanceof HTMLElement)) return;
                        const pointerId = event.pointerId;
                        const grab = timeAt(event.clientX, track) - frame.time;
                        const move = (moveEvent: PointerEvent) => {
                          if (moveEvent.pointerId !== pointerId || !track.isConnected) return;
                          const max = Math.max(0, seconds - honk.duration);
                          frame.time = Math.min(max, Math.max(0, timeAt(moveEvent.clientX, track) - grab));
                          publish();
                          handle.update();
                        };
                        const end = (endEvent: PointerEvent) => {
                          if (endEvent.pointerId !== pointerId) return;
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", end);
                          window.removeEventListener("pointercancel", end);
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", end);
                        window.addEventListener("pointercancel", end);
                      }),
                    ]}
                    style={{
                      left: `calc(14rem + (100% - 14rem) * ${frame.time / seconds})`,
                      width: `calc((100% - 14rem) * ${honk.duration / seconds})`,
                    }}
                  >
                    <svg viewBox={`0 0 ${honk.peaks.length} 100`} preserveAspectRatio="none">
                      {honk.peaks.map((peak, bar) => (
                        <rect
                          key={bar}
                          x={bar}
                          y={50 - peak * 50}
                          width="1"
                          height={Math.max(peak * 100, 1)}
                          fill="currentColor"
                        />
                      ))}
                    </svg>
                  </span>
                ) : null,
              )}
            {type !== "sound" && item.keyframes.slice(0, -1).map((frame, index) => {
              const next = item.keyframes[index + 1]!;
              return (
                <span
                  key={`${frame.time}-${next.time}`}
                  mix={segment}
                  style={{
                    left: `calc(14rem + (100% - 14rem) * ${frame.time / seconds})`,
                    width: `calc((100% - 14rem) * ${(next.time - frame.time) / seconds})`,
                  }}
                >
                  <BlendLine
                    mode={frame.blend}
                    params={frame.params}
                    onBezier={(params) => {
                      frame.params = params;
                      publish();
                      handle.update();
                    }}
                  />
                  <span
                    mix={[
                      blendMode,
                      on("pointerdown", (event) => {
                        event.stopPropagation();
                      }),
                    ]}
                  >
                    <BlendOptions
                      mode={frame.blend}
                      params={frame.params}
                      onMode={(mode) => {
                        frame.blend = mode;
                        frame.params = [...blendDefaults[mode]];
                        publish();
                        handle.update();
                      }}
                      onParam={(index, next) => {
                        frame.params[index] = next;
                        publish();
                        handle.update();
                      }}
                    />
                  </span>
                </span>
              );
            })}
            {type !== "sound" && item.keyframes.map((frame, index) => (
              <span
                key={index}
                mix={[
                  keyframe,
                  on("pointerdown", (event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    event.preventDefault();
                    const track = event.currentTarget.parentElement;
                    if (!(track instanceof HTMLElement)) return;
                    const pointerId = event.pointerId;
                    const gap = 0.01;
                    const move = (moveEvent: PointerEvent) => {
                      if (moveEvent.pointerId !== pointerId || !track.isConnected) return;
                      const previous = item.keyframes[index - 1];
                      const next = item.keyframes[index + 1];
                      const min = previous ? previous.time + gap : 0;
                      const max = next ? next.time - gap : seconds;
                      frame.time = Math.min(max, Math.max(min, timeAt(moveEvent.clientX, track)));
                      publish();
                      handle.update();
                    };
                    const end = (endEvent: PointerEvent) => {
                      if (endEvent.pointerId !== pointerId) return;
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", end);
                      window.removeEventListener("pointercancel", end);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", end);
                    window.addEventListener("pointercancel", end);
                  }),
                ]}
                style={{ left: `calc(14rem + (100% - 14rem) * ${frame.time / seconds})` }}
              >
                <KeyFrame type={type} value={frame.value} />
              </span>
            ))}
          </div>
          );
        })}
        <div mix={playhead} style={{ left: `calc(14rem + (100% - 14rem) * ${time / seconds})` }}>
          <span>{time.toFixed(2)}s</span>
        </div>
      </div>}
    </div>
  );
});

const waveform = css({
  position: "absolute",
  zIndex: 1,
  top: "0.25rem",
  bottom: "0.25rem",
  boxSizing: "border-box",
  background: "transparent",
  color: "#7dd3fc",
  cursor: "ew-resize",
  touchAction: "none",
  "&:hover": {
    background: "var(--hover)",
  },
  "& svg": {
    display: "block",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
});

const segment = css({
  position: "absolute",
  top: "50%",
  height: "2px",
  transform: "translateY(-50%)",
  pointerEvents: "none",
});

const blendMode = css({
  position: "absolute",
  zIndex: 1,
  left: 0,
  paddingLeft: "0.5rem",
  bottom: "calc(100% + 2px)",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
  pointerEvents: "auto",
  "& button": {
    marginLeft: 0,
  },
});

const keyframe = css({
  position: "absolute",
  zIndex: 1,
  top: "50%",
  width: "0.75rem",
  height: "0.75rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transform: "translate(-50%, -50%)",
  opacity: 1,
  cursor: "ew-resize",
  touchAction: "none",
});

const track = css({
  position: "relative",
  width: "100%",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  minHeight: "2.5rem",
  "&:hover": {
    background: "#ffffff08",
  },
  padding: "0.25rem 0.25rem",
  cursor: "ew-resize",
});

const trackName = css({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "0.25rem",
  width: "fit-content",
  boxSizing: "border-box",
  padding: "0.25rem 0.25rem 0.25rem 0.375rem",
  borderRadius: "6px",
  cursor: "pointer",
  "&:hover": {
    background: "var(--hover)",
  },
});

const timeline = css({
  boxSizing: "border-box",
  flex: "0 0 10rem",
  minHeight: "14rem",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  position: "relative",
});

const timelineCollapsed = css({
  flex: "0 0 0",
  minHeight: 0,
});

const markStack = css({
  display: "grid",
  flex: "0 0 auto",
  placeItems: "center",
  "& > *": { gridArea: "1 / 1" },
});

const hideToggle = css({
  appearance: "none",
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: "0.45rem",
  bottom: "calc(100% + 0.35rem)",
  boxSizing: "border-box",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "13px",
  height: "2.25rem",
  justifyContent: "center",
  left: "0.5rem",
  padding: "0 0.6rem",
  position: "absolute",
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

const hideToggleCollapsed = css({
  bottom: "0.4rem",
});

const scrub = css({
  userSelect: "none",
  cursor: "ew-resize",
});

const quietHover = css({
  "&:hover": {
    background: "transparent",
  },
});

const sheet = css({
  position: "relative",
  minWidth: 0,
  flex: "1 1 auto",
  overflow: "hidden",
});

const rulerRow = css({
  height: "1.5rem",
});

const lanes = css({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "14rem",
  right: 0,
  overflow: "hidden",
  pointerEvents: "none",
  cursor: "ew-resize",
});

const tick = css({
  position: "absolute",
  top: 0,
  bottom: 0,
  width: "1px",
  background: "#ffffff33",
  pointerEvents: "none",
  transform: "translateX(-50%)",
  "& span": {
    position: "absolute",
    top: 0,
    left: "0.25rem",
    fontSize: "0.65rem",
    color: "#ffffff88",
    whiteSpace: "nowrap",
  },
});

const playhead = css({
  position: "absolute",
  top: 0,
  bottom: 0,
  width: "1px",
  background: "#7dd3fc",
  pointerEvents: "none",
  "& span": {
    position: "absolute",
    top: 0,
    left: "0.25rem",
    fontSize: "0.65rem",
    color: "#7dd3fc",
    whiteSpace: "nowrap",
  },
});
