import { PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "../utils/cn.js";

export function SidebarToggleButton({
  open,
  onToggle,
  className,
  ...props
}: {
  open: boolean;
  onToggle: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? "Close scene" : "Open scene"}
      className={cn(
        "flex items-center gap-1.5 py-1.5 px-3 text-[13px] cursor-pointer border rounded-md font-[var(--vscode-font-family,inherit)]",
        "border-[var(--vscode-button-border,transparent)]",
        "bg-[var(--vscode-button-background,#0e639c)] text-[var(--vscode-button-foreground,#fff)]",
        className
      )}
      {...props}
    >
      {open ? (
        <>
          <PanelLeftClose size={14} aria-hidden />
          Close
        </>
      ) : (
        <>
          <PanelLeft size={14} aria-hidden />
          Scene
        </>
      )}
    </button>
  );
}
