import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn.js";

export function OverlayButton({
  className,
  variant = "default",
  children,
  ...props
}: {
  variant?: "default" | "danger";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[22px] min-h-[22px] items-center justify-center gap-1 px-1.5 py-0 text-xs cursor-pointer border border-solid rounded font-[var(--vscode-font-family)] box-border",
        variant === "default" &&
          "bg-[var(--color-highlight)] text-[var(--color-on-accent)] border-[var(--color-highlight)]",
        variant === "danger" &&
          "bg-[var(--color-red)] text-[var(--color-on-accent)] border-[var(--color-red)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
