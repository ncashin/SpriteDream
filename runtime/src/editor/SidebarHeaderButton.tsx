import type { LucideIcon } from "lucide-react";
import { cn } from "../utils/cn";

export const SidebarHeaderButton = ({
  icon: Icon,
  className,
  ...props
}: { icon: LucideIcon } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
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
      <Icon size={24} strokeWidth={1.5} />
    </button>
  );
};
