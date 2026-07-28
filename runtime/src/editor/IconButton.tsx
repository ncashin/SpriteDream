import cn from "cnfast";
import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "react-aria-components";

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
  slot?: ButtonProps["slot"];
}

export function IconButton({ icon: Icon, onClick, className, slot }: IconButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex p-0.5 cursor-pointer hover:bg-hover-light items-center justify-center  transition-colorsfocus:outline-none",
        className,
      )}
      slot={slot}
    >
      <Icon className="size-4" />
    </Button>
  );
}
