import cn from "cnfast";
import { ChevronRight } from "lucide-react";
import { useState, type PropsWithChildren } from "react";

export const Dropdown = ({
  className,
  buttonClassName,
  children,
}: PropsWithChildren<{ className: string; buttonClassName?: string }>) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={className}>
      <button
        className={cn("header", buttonClassName)}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span>Game Objects</span>
        <ChevronRight className={cn("icon-size", expanded && "rotate-90")} />
      </button>
      {expanded && children}
    </div>
  );
};
