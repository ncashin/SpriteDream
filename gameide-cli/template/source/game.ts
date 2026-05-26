import { onGameStart } from "gameide";
import type { RuntimeGameContext } from "./index";

export default function main(_gameContext: RuntimeGameContext): void {
  onGameStart(() => {
    console.log("Game started");
  });
}
