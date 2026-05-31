import { type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

const rowHover = "hover:bg-[var(--color-hover)]";

export const sceneTreeRowIconFrameSizeClass =
  "h-[18px] min-h-[18px] w-[18px] min-w-[18px] box-border";

export type SceneTreeRowIconFrameProps = {
  children: ReactNode;
  className?: string;
};

export function SceneTreeRowIconFrame({
  children,
  className,
}: SceneTreeRowIconFrameProps) {
  return (
    <div
      className={cn(
        "scene-tree-icon-frame flex shrink-0 self-center items-center justify-center rounded p-0.5",
        sceneTreeRowIconFrameSizeClass,
        rowHover,
        "opacity-70 hover:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
