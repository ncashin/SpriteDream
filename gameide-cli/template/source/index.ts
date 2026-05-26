import {
  editorPlugin,
  gameide,
  gameUIPlugin,
  inputPlugin,
  pixiPlugin,
} from "gameide";
import invariant from "tiny-invariant";
import mainScene from "./scenes/main.scene";
import "./style.css";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";
import main from "./game";

const rootElement = document.getElementById("app");
invariant(rootElement);

const game = await gameide({
  rootElement,
  initialContext: {},
  initialScene: mainScene,
  plugins: [
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    inputPlugin({
      axes: {},
      buttons: {},
      mouseHandling: "editor",
    }),
    pixiPlugin({
      initOptions: {
        backgroundAlpha: 0,
      },
    }),
  ],
});

export const { gameContext } = game;
export type RuntimeGameContext = typeof gameContext;
main(gameContext);
