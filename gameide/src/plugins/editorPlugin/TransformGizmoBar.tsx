import { Move, RotateCw, Scaling } from "lucide-react";
import type { ReactNode } from "react";
import { GameIDEMode } from "../../lifecycle/mode.js";
import { useGameIDEMode } from "../../hooks/useGameIDEMode.js";
import { useSelectedObject } from "../../hooks/useSelectedObject.js";
import { useTransformGizmoTool } from "../../hooks/useTransformGizmoTool.js";
import { implementsTrait } from "../../trait/trait.js";
import { spriteTrait } from "../pixiPlugin/sprite.js";
import {
  setTransformGizmoTool,
  type TransformGizmoTool,
} from "./transformGizmoTool.js";
import { cn } from "../../utils/cn.js";

function ToolBtn({
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
        "flex h-full w-[22px] min-w-[22px] shrink-0 items-center justify-center p-0 rounded-[3px] border border-solid cursor-pointer box-border",
        "font-[var(--vscode-font-family)]",
        active
          ? "border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]"
          : "border-transparent text-[var(--vscode-descriptionForeground)] bg-transparent hover:bg-[color-mix(in_srgb,var(--vscode-toolbar-hoverBackground)_60%,transparent)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Blender-style translate / rotate / scale tool strip; Pixi overlay follows the selected tool.
 */
export function TransformGizmoBar() {
  const mode = useGameIDEMode();
  const { selectedObject } = useSelectedObject();
  const tool = useTransformGizmoTool();

  if (mode !== GameIDEMode.Editor) return null;
  if (!selectedObject || !implementsTrait(spriteTrait)(selectedObject)) return null;

  const choose = (t: TransformGizmoTool) => setTransformGizmoTool(t);

  return (
    <div
      className={cn(
        "flex h-[22px] min-h-[22px] items-center gap-0.5 px-0.5 py-0 border border-solid rounded font-[var(--vscode-font-family)] box-border",
        "border-[var(--vscode-widget-border)] bg-[color-mix(in_srgb,var(--vscode-editor-background)_92%,transparent)]",
      )}
      role="toolbar"
      aria-label="Transform gizmo tool"
    >
      <ToolBtn
        active={tool === "translate"}
        title="Move — drag axes or the yellow square (XY)"
        onClick={() => choose("translate")}
      >
        <Move size={12} strokeWidth={2} aria-hidden />
      </ToolBtn>
      <ToolBtn
        active={tool === "rotate"}
        title="Rotate — drag the blue ring (Z)"
        onClick={() => choose("rotate")}
      >
        <RotateCw size={12} strokeWidth={2} aria-hidden />
      </ToolBtn>
      <ToolBtn
        active={tool === "scale"}
        title="Scale — drag axis cubes or the violet square (uniform)"
        onClick={() => choose("scale")}
      >
        <Scaling size={12} strokeWidth={2} aria-hidden />
      </ToolBtn>
    </div>
  );
}
