import { useContext, useLayoutEffect } from "react";
import { GameViewContext } from "./GameViewReadyProvider";

export default function GameView() {
  const gameViewReady = useContext(GameViewContext);
  useLayoutEffect(gameViewReady);
  return <div id="game-view" className="w-full h-full" />;
}
