import { type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

const rowHover = "hover:bg-[var(--color-hover)]";

/** p-0.5 (2px) + 14px icon = 18px; use for all scene tree row action hit targets. */
export const sceneTreeRowIconFrameSizeClass =
  "h-[18px] min-h-[18px] w-[18px] min-w-[18px] box-border";

export type SceneTreeRowIconFrameProps = {
  children: ReactNode;
  className?: string;
};

/** Padded hover frame matching the scene tree row action icons (chevron, add, delete). */
export function SceneTreeRowIconFrame({
  children,
  className,
}: SceneTreeRowIconFrameProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 self-center items-center justify-center rounded p-0.5",
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
