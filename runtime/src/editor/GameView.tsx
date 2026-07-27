import { useContext, useLayoutEffect } from "react";
import { GameViewContext } from "./GameViewProvider";

export default function GameView() {
  const markReady = useContext(GameViewContext);
  useLayoutEffect(markReady);
  return <div id="game-view" className="w-full h-full" />;
}
