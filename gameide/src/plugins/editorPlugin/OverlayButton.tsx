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
        "flex h-[22px] min-h-[22px] items-center justify-center gap-1 px-1.5 py-0 text-xs cursor-pointer border border-solid rounded font-[var(--vscode-font-family)] box-border",
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
