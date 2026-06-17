import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

type OverlayButtonProps = {
  children: ReactNode;
  variant?: "default" | "danger";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function OverlayButton({
  variant = "default",
  className,
  children,
  ...props
}: OverlayButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[22px] min-h-[22px] shrink-0 items-center gap-1 border-0 px-1.5 py-0",
        "bg-[color-mix(in_srgb,var(--color-hover)_45%,transparent)]",
        "text-xs font-[var(--vscode-font-family)] cursor-pointer outline-none box-border",
        "hover:bg-[var(--color-hover)] focus-visible:bg-[var(--color-hover)]",
        "focus-visible:ring-1 focus-visible:ring-[var(--color-highlight)]",
        "disabled:cursor-default disabled:opacity-45",
        variant === "danger"
          ? "text-[var(--color-red)]"
          : "text-[var(--color-text)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
