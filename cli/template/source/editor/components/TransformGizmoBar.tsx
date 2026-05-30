import { Move, RotateCw, Scaling } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import {
  getTransformGizmoToolSnapshot,
  setTransformGizmoTool,
  subscribeTransformGizmoTool,
  type TransformGizmoTool,
} from "./transformGizmoTool.js";
import { cn } from "../../utils/cn.js";

function useTransformGizmoTool(): TransformGizmoTool {
  return useSyncExternalStore(
    subscribeTransformGizmoTool,
    getTransformGizmoToolSnapshot,
    getTransformGizmoToolSnapshot,
  );
}

function ToolButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-full w-[22px] min-w-[22px] shrink-0 items-center justify-center p-0 rounded-[3px] cursor-pointer box-border border-0 outline-none",
        "font-[var(--vscode-font-family)]",
        active
          ? "bg-[var(--color-highlight)] text-[var(--color-on-accent)]"
          : "text-[var(--color-muted)] bg-transparent hover:bg-[color-mix(in_srgb,var(--color-hover)_60%,transparent)]",
      )}
    >
      {children}
    </button>
  );
}


export function TransformGizmoBar() {
  const tool = useTransformGizmoTool();

  const choose = (t: TransformGizmoTool) => setTransformGizmoTool(t);

  return (
    <div
      className={cn(
        "flex h-[22px] min-h-[22px] items-center gap-0.5 px-0.5 py-0 rounded font-[var(--vscode-font-family)] box-border",
        "bg-[color-mix(in_srgb,var(--color-bg)_92%,transparent)]",
      )}
      role="toolbar"
      aria-label="Transform gizmo tool"
    >
      <ToolButton
        active={tool === "translate"}
        title="Move — drag axes or the yellow square (XY)"
        onClick={() => choose("translate")}
      >
        <Move size={12} strokeWidth={2} aria-hidden />
      </ToolButton>
      <ToolButton
        active={tool === "rotate"}
        title="Rotate — drag the blue ring (Z)"
        onClick={() => choose("rotate")}
      >
        <RotateCw size={12} strokeWidth={2} aria-hidden />
      </ToolButton>
      <ToolButton
        active={tool === "scale"}
        title="Scale — drag axis cubes or the violet square (uniform)"
        onClick={() => choose("scale")}
      >
        <Scaling size={12} strokeWidth={2} aria-hidden />
      </ToolButton>
    </div>
  );
}
