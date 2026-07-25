import cn from "cnfast";
import type { LucideIcon } from "lucide-react";

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
}

export function IconButton({ icon: Icon, onClick, className }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex p-0.5 hover:bg-hover-light items-center justify-center  transition-colorsfocus:outline-none",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
