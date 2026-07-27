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
      <button className={cn("header", buttonClassName)} onClick={() => setExpanded(!expanded)}>
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
