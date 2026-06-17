import { Move, RotateCw, Scaling } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  getTransformGizmoToolSnapshot,
  setTransformGizmoTool,
  subscribeTransformGizmoTool,
  type TransformGizmoTool,
} from "./transformGizmoTool.js";
import { IconButton } from "./IconButton.js";
import { cn } from "../../utils/cn.js";

function useTransformGizmoTool(): TransformGizmoTool {
  return useSyncExternalStore(
    subscribeTransformGizmoTool,
    getTransformGizmoToolSnapshot,
    getTransformGizmoToolSnapshot,
  );
}

export function TransformGizmoBar() {
  const tool = useTransformGizmoTool();

  const choose = (t: TransformGizmoTool) => setTransformGizmoTool(t);

  const toolButtonClass = (active: boolean) =>
    cn(
      active
        ? "bg-[var(--color-highlight)] text-[var(--color-on-accent)] hover:bg-[var(--color-highlight)]"
        : "text-[var(--color-muted)]",
    );

  return (
    <div
      className="flex h-[22px] min-h-[22px] items-center gap-0.5"
      role="toolbar"
      aria-label="Transform gizmo tool"
    >
      <IconButton
        title="Move — drag axes or the yellow square (XY)"
        aria-pressed={tool === "translate"}
        onClick={() => choose("translate")}
        className={toolButtonClass(tool === "translate")}
      >
        <Move size={12} strokeWidth={2} aria-hidden />
      </IconButton>
      <IconButton
        title="Rotate — drag the blue ring (Z)"
        aria-pressed={tool === "rotate"}
        onClick={() => choose("rotate")}
        className={toolButtonClass(tool === "rotate")}
      >
        <RotateCw size={12} strokeWidth={2} aria-hidden />
      </IconButton>
      <IconButton
        title="Scale — drag axis cubes or the violet square (uniform)"
        aria-pressed={tool === "scale"}
        onClick={() => choose("scale")}
        className={toolButtonClass(tool === "scale")}
      >
        <Scaling size={12} strokeWidth={2} aria-hidden />
      </IconButton>
    </div>
  );
}
