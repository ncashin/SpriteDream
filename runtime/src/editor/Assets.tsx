import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../utils/cn";

export const Assets = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={cn(
        "flex flex-col",
        expanded && "min-h-0 flex-[4]",
        !expanded && "pb-1"
      )}
    >
      <div className="-mx-1.5 border-t border-[#444444]" />
      <div className="flex flex-col pt-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mb-1.5 mt-1 w-full flex items-center gap-1 text-left text-sm font-medium text-dark-tx sidebar-padding rounded-md"
        >
          <span>Assets</span>
          {expanded ? (
            <ChevronDown size={14} className="shrink-0" />
          ) : (
            <ChevronRight size={14} className="shrink-0" />
          )}
        </button>

        {expanded && (
          <div
            className={cn(
              "flex-1 min-h-0 overflow-x-auto pb-8 text-sm text-dark-tx",
              `
                [&::-webkit-scrollbar]:h-1
                [&::-webkit-scrollbar-track]:bg-dark-ui-2
                [&::-webkit-scrollbar-thumb]:bg-light-ui-3
              `
            )}
          >
          <div className="sidebar-padding flex flex-col gap-1 items-start text-dark-fg-muted">
            <div className="py-1.5 px-2 rounded-md sidebar-hover text-left">
              <span className="truncate text-dark-fg-muted">No assets yet</span>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
};
