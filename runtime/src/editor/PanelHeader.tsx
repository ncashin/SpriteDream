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
    className={cn("panel-inner-x shrink-0", className)}
  >
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-1 !pt-3.5 !pb-3.5 text-left text-sm font-semibold text-dark-tx-3 hover:text-[var(--editor-text-visible)] rounded-md transition-colors",
        alignWithIconRow ? "sidebar-padding-header" : "sidebar-padding"
      )}
    >
      <span className="">{title}</span>
    
    </button>
    {expanded && children}
  </div>
);
