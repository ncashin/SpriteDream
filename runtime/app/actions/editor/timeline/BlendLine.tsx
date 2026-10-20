import { css } from "remix/component";
import type { Handle } from "remix/component";

import { blendAmount, type BlendMode } from "./blend.ts";
import { Bezier } from "./Bezier.tsx";

export function BlendLine(handle: Handle<{ mode: BlendMode; params: readonly number[]; onBezier: (params: number[]) => void }>) {
  return () => {
    const { mode, params, onBezier } = handle.props;
    if (mode === "none") return null;
    if (mode === "bezier") return <Bezier params={params} onChange={onBezier} />;
    return (
      <svg mix={blendCurve} viewBox="0 0 100 24" preserveAspectRatio="none">
        <path
          d={blendPath(mode, params)}
          fill="none"
          stroke={blendStroke(mode)}
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    );
  };
}

function blendPath(mode: BlendMode, params: readonly number[]) {
  const drop = "L 100 2 L 100 12";
  if (mode === "linear") return `M 0 12 ${drop}`;
  const points = Array.from({ length: 17 }, (_, step) => {
    const t = step / 16;
    const amount = Math.min(1, Math.max(0, blendAmount(t, mode, params)));
    return `L ${(t * 100).toFixed(2)} ${(12 - amount * 10).toFixed(2)}`;
  });
  return `M 0 12 ${points.join(" ")} ${drop}`;
}

function blendStroke(mode: BlendMode) {
  if (mode === "lerp") return "#7dd3fc";
  if (mode === "slerp") return "#f0abfc";
  return "#ffffff88";
}

const blendCurve = css({
  position: "absolute",
  left: 0,
  width: "100%",
  height: "2.75rem",
  top: "50%",
  transform: "translateY(-50%)",
  overflow: "visible",
  pointerEvents: "none",
});
