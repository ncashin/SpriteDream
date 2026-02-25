import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../utils/cn";

export type PanelHeaderProps = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  /** Use icon-row left padding so title aligns with rows below (e.g. Searchbar, object rows) */
  alignWithIconRow?: boolean;
  children?: React.ReactNode;
};

export const PanelHeader = ({
  title,
  expanded,
  onToggle,
  className,
  alignWithIconRow,
  children,
}: PanelHeaderProps) => (
  <div
    className={cn("panel-inner-x pt-3 shrink-0 sticky top-0 z-10 pb-2", className)}
    style={{ backgroundColor: "rgba(44, 44, 44, 0.98)" }}
  >
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "font-bold mb-1.5 mt-1 w-full flex items-center gap-1 text-left text-sm font-medium text-dark-tx-3 hover:text-white rounded-md transition-colors",
        alignWithIconRow ? "sidebar-padding-header" : "sidebar-padding"
      )}
    >
      <span>{title}</span>
    
    </button>
    {expanded && children}
  </div>
);
