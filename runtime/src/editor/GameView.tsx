import { useEffect } from "react";
import { cn } from "../utils/cn";

export type GameViewProps = {
  src?: string;
  className?: string;
  title?: string;
  runMode?: boolean;
  /** Called when the iframe has loaded with its contentWindow for scene sync. */
  onIframeLoad?: (iframeWindow: Window | null) => void;
};

export const GameView = ({
  src = "/game.html",
  className,
  title = "Game",
  runMode = false,
  onIframeLoad,
}: GameViewProps) => {
  const iframeSrc = runMode ? `${src}?run=true` : src;
  useEffect(() => {
    return () => onIframeLoad?.(null);
  }, [onIframeLoad]);
  return (
    <iframe
      src={iframeSrc}
      title={title}
      className={cn(
        "game-view-iframe absolute inset-0 block w-full min-w-full h-full min-h-0 border-0",
        className
      )}
      onLoad={(e) =>
        onIframeLoad?.((e.target as HTMLIFrameElement).contentWindow ?? null)
      }
    />
  );
};
