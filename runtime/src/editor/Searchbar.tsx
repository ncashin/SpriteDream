import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "../utils/cn";

export const Searchbar = ({
  className,
  rightAdornment,
  dropdown,
}: {
  className?: string;
  rightAdornment?: React.ReactNode;
  /** Rendered as sibling of the hover row so hovering dropdown doesn't highlight the row */
  dropdown?: React.ReactNode;
}) => {
  const [search, setSearch] = useState("");

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-row justify-between items-center w-full gap-1.5 sidebar-padding-icon-row rounded-md group sidebar-hover"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="p-0.5 shrink-0">
            <Search size={16} strokeWidth={1.5} />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-transparent outline-none text-editor-text-light placeholder:text-dark-tx-3 w-full min-w-0"
          />
        </div>
        {rightAdornment != null && (
          <div className="flex flex-row shrink-0 group-hover:visible">
            {rightAdornment}
          </div>
        )}
      </div>
      {dropdown}
    </div>
  );
}
