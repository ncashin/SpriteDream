import type { ReactNode } from "react";
import { cn } from "../utils/cn.js";

type SidebarProps = {
  open: boolean;
  width?: string;
  children: ReactNode;
  className?: string;
};

export function Sidebar({
  open,
  width = "w-96",
  children,
  className,
}: SidebarProps) {
  return (
    <div
      className={cn(
        "h-full max-w-[85vw] flex-none bg-[var(--vscode-editor-background)] border-r border-[var(--vscode-panel-border)] overflow-auto z-[2147483646]",
        width,
        !open && "hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

