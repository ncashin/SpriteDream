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
        className={cn(
          "w-full flex flex-row justify-between items-center px-2 py-1",
          buttonClassName,
        )}
        onClick={() => setExpanded(!expanded)}
      >
        Game Objects
        <ChevronRight className={cn("size-4", expanded && "rotate-90")} />{" "}
      </button>
      {expanded && children}
    </div>
  );
};
