import { cn } from "../utils/cn.js";

export function OverlayButton({
  className,
  variant = "default",
  children,
  ...props
}: {
  variant?: "default" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-0.5 py-0.5 px-1.5 text-xs cursor-pointer border border-solid rounded font-[var(--vscode-font-family,inherit)]",
        variant === "default" &&
          "bg-[var(--vscode-button-background,#0e639c)] text-[var(--vscode-button-foreground,#fff)] border-[var(--vscode-button-background,#0e639c)]",
        variant === "danger" &&
          "bg-[var(--vscode-errorForeground,#f14c4c)] text-[var(--vscode-button-foreground,#fff)] border-[var(--vscode-errorForeground,#f14c4c)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
