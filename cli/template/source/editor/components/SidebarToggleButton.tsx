import type { ButtonHTMLAttributes } from "react";
import { Cuboid, MoveLeft } from "lucide-react";
import { OverlayButton } from "./OverlayButton.js";

export function SidebarToggleButton({
  open,
  onToggle,
  className,
  ...props
}: {
  open: boolean;
  onToggle: () => void;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <OverlayButton
      onClick={onToggle}
      title={open ? "Close scene" : "Open scene"}
      className={className}
      {...props}
    >
      {open ? (
        <>
          <MoveLeft size={12} aria-hidden />
          Scene View
        </>
      ) : (
        <>
          <Cuboid size={12} aria-hidden />
          Scene View
        </>
      )}
    </OverlayButton>
  );
}
