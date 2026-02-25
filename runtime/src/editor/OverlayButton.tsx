
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
      className="flex flex-row items-center justify-between gap-1 hover:bg-dark-bg pl-2 pr-2 gap-0.5 py-0.5 rounded-md text-sm font-bold"
      {...props}
    >
      <span>{text}</span>
      {Icon && <Icon size={12} strokeWidth={1.5} />}
    </button>
  );
};

