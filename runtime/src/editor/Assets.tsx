import { useState } from "react";
import { cn } from "../utils/cn";
import { PanelHeader } from "./PanelHeader";

export const Assets = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={cn(
        "flex flex-col",
        expanded && "min-h-0 flex-[4]"
      )}
    >
      <PanelHeader
        title="Assets"
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        className={cn("panel-inner-x shrink-0 !pt-1.5 pb-1", expanded && "!pb-0 ")}
      />

      {expanded && (
        <div
          className={cn(
            "panel-inner !pt-0 text-sm text-dark-tx min-w-0 overflow-y-auto overflow-x-auto min-h-0 flex-1",
            "[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-light-ui-3"
          )}
        >
          <div className="sidebar-padding flex flex-col gap-1 items-start text-dark-fg-muted">
            <div className="py-0.5 rounded-md">
              <span className="truncate text-dark-fg-muted">No assets yet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
