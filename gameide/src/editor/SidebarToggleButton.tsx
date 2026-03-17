import { Cuboid, CuboidIcon, MoveLeft, PanelLeft, PanelLeftClose } from "lucide-react";
import { OverlayButton } from "./OverlayButton.js";

export function SidebarToggleButton({
  open,
  onToggle,
  className,
  ...props
}: {
  open: boolean;
  onToggle: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
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
          Close
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
