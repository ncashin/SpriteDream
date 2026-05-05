import { forwardRef } from "react";
import { cn } from "../../utils/cn.js";

type GameViewProps = {
  className?: string;
};

export const GameView = forwardRef<HTMLDivElement, GameViewProps>(
  function GameView({ className }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex-1 min-w-0 min-h-0 overflow-hidden bg-black",
          className,
        )}
      />
    );
  },
);
