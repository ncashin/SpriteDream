
import React from "react";

type OverlayButtonProps = {
  text: string;
  icon?: React.ElementType;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const OverlayButton = ({
  text,
  icon: Icon,
  ...props
}: OverlayButtonProps) => {
  return (
    <button
      className="flex flex-row items-center gap-0.5 pl-2 pr-2.5 pt-1.5 py-0.5 rounded-md text-xs sidebar-hover"
      {...props}
    >
      {Icon && <Icon size={12} strokeWidth={1.5} />}
      <span>{text}</span>
    </button>
  );
};

