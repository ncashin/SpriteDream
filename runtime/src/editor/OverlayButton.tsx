
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
      className="flex flex-row items-center pl-2.5 pr-2 py-1 gap-1 rounded-md text-xs bg-editor-background sidebar-hover"
      {...props}
    >
      <span>{text}</span>
      {Icon && <Icon size={12} strokeWidth={1.5} />}

    </button>
  );
};

