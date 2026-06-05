import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export function IconButton({
  className,
  children,
  ...props
}: {
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex shrink-0 items-center justify-center rounded border-0 bg-transparent p-0.5 outline-none",
        "text-[var(--color-text)] cursor-pointer",
        "hover:bg-[var(--color-hover)] focus-visible:ring-1 focus-visible:ring-[var(--color-highlight)]",
        "disabled:cursor-default disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
