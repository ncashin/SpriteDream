import type { LucideIcon } from "lucide-react";

export const IconButton = ({ icon: Icon, ...props }: { icon: LucideIcon } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (props.onClick) {
      props.onClick(e);
    }
  };

  return (
    <button
      {...props}
      className="p-0.5 cursor-pointer flex items-center justify-center rounded bg-transparent hover:bg-dark-ui-3 transition-colors"
      type="button"
      onClick={handleClick}
    >
      <Icon size={16} strokeWidth={2.5} />
    </button>
  );
};