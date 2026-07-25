import cn from "cnfast";
import { ChevronRight } from "lucide-react";
import { useState, type PropsWithChildren } from "react";
import { IconButton } from "./IconButton";

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
          "w-full flex flex-row justify-between items-center pl-2 pr-1 py-1",
          buttonClassName,
        )}
        onClick={() => setExpanded(!expanded)}
      >
        Game Objects
        <IconButton
          icon={ChevronRight}
          onClick={() => setExpanded(!expanded)}
          className={cn(expanded && "rotate-90")}
        />
      </button>
      {expanded && children}
    </div>
  );
};
