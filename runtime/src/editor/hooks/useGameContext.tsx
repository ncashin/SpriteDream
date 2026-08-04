import { useContext } from "react";
import invariant from "tiny-invariant";
import { ReactGameContext } from "../GameContextProvider";

export default function useGameContext() {
  const gameContext = useContext(ReactGameContext);
  invariant(gameContext, "useGameContext must be used inside GameContextProvider");
  return gameContext;
}
