import React from "react";
import { cn } from "../utils/cn";

type DropdownProps = {
  children: React.ReactNode;
  className?: string;
};

export const Dropdown: React.FC<DropdownProps> = ({ children, className, }) => {
  return (
    <div className={cn("absolute z-20 min-w-48 rounded-md bg-dark-bg shadow-lg border border-dark-ui-3", className)}>
      {children}
    </div>
  );
};