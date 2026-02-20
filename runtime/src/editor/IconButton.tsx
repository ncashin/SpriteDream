import type { LucideIcon } from "lucide-react";

export const IconButton = ({ icon: Icon, ...props }: { icon: LucideIcon } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button {...props} className="flex items-center justify-center p-0.5 rounded bg-transparent hover:bg-dark-ui-2 transition-colors" type="button">
      <Icon size={16} strokeWidth={2.5} />
    </button>
  );
};