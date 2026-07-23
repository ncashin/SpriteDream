import { useContext, useLayoutEffect } from "react";
import { ReadyContext } from "./ReadyProvider";

export default function GameView() {
  const markReady = useContext(ReadyContext);
  useLayoutEffect(markReady);
  return <div id="game-view" className="w-full h-full" />;
}
