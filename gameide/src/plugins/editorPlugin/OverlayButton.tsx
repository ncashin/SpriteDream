import { cn } from "../../utils/cn.js";

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
        "flex items-center gap-1 py-0.5 px-1.5 text-xs cursor-pointer border border-solid rounded font-[var(--vscode-font-family)]",
        variant === "default" &&
          "bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-[var(--vscode-button-background)]",
        variant === "danger" &&
          "bg-[var(--vscode-errorForeground)] text-[var(--vscode-button-foreground)] border-[var(--vscode-errorForeground)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
