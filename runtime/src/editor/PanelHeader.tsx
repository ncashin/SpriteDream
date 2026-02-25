import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../utils/cn";

export type PanelHeaderProps = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  children?: React.ReactNode;
};

export const PanelHeader = ({
  title,
  expanded,
  onToggle,
  className,
  children,
}: PanelHeaderProps) => (
  <div
    className={cn("panel-inner-x pt-3 shrink-0 sticky top-0 z-10 pb-2", className)}
    style={{ backgroundColor: "rgba(44, 44, 44, 0.98)" }}
  >
    <button
      type="button"
      onClick={onToggle}
      className="mb-1.5 mt-1 w-full flex items-center gap-1 text-left text-sm font-medium text-dark-tx sidebar-padding rounded-md"
    >
      <span>{title}</span>
      {expanded ? (
        <ChevronDown size={14} className="shrink-0" />
      ) : (
        <ChevronRight size={14} className="shrink-0" />
      )}
    </button>
    {expanded && children}
  </div>
);
