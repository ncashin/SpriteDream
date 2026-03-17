import { cn } from "../utils/cn.js";

type GameViewProps = {
  className?: string;
};

export function GameView({ className }: GameViewProps) {
  return (
    <div
      id="gameide-game-root"
      className={cn(
        "relative flex-1 min-w-0 min-h-0 overflow-hidden bg-black",
        className,
      )}
    />
  );
}

