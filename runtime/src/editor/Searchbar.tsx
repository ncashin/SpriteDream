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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-row justify-between items-center w-full gap-1.5 px-2 py-1.5 sidebar-hover rounded-md sidebar-padding pb-2 font-semibold group",
          isFocused && "bg-dark-ui-2"
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
            className="bg-transparent outline-none text-light-ui w-full min-w-0"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
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
