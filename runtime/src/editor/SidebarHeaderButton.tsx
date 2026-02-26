import type { LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";

type SidebarHeaderButtonProps = {
  icon: LucideIcon;
  size?: number;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size">;

export const SidebarHeaderButton = ({
  icon: Icon,
  size = 24,
  className,
  ...props
}: SidebarHeaderButtonProps) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (props.onClick) props.onClick(e);
  };

  return (
    <button
      {...props}
      type="button"
      onClick={handleClick}
      className={cn(
        "p-2 shrink-0 flex items-center justify-center rounded-md bg-transparent hover:bg-dark-ui-3 transition-colors cursor-pointer",
        className
      )}
    >
      <Icon size={size} strokeWidth={1.5} />
    </button>
  );
};
