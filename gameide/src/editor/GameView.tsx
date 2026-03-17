import { cn } from "../utils/cn.js";

type GameViewProps = {
  className?: string;
};

/**
 * Container for the running game viewport.
 *
 * The game's `rootElement` should be mounted into the DOM element this
 * component renders (for example, by selecting it via `document.querySelector`)
 * instead of being passed as a React child. This keeps the scene view sidebar
 * from overlapping the actual game viewport.
 */
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

