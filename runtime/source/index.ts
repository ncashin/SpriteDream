import {
  editorPlugin,
  gameide,
  gameUIPlugin,
  inputPlugin,
  networkingPlugin,
  pixiPlugin,
  planckPlugin,
} from "gameide";
import invariant from "tiny-invariant";
import exampleScene from "./scenes/example.scene";
import "./style.css";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";
import main from "./game";

const rootElement = document.getElementById("app");
invariant(rootElement);

const game = await gameide({
  rootElement,
  initialContext: {},
  initialScene: exampleScene,
  plugins: [
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    networkingPlugin({
      room: "default",
    }),
    inputPlugin({
      axes: {
        Horizontal: {
          negative: ["KeyA", "KeyArrowLeft"],
          positive: ["KeyD", "KeyArrowRight"],
        },
      },
      mouseHandling: "editor",
      buttons: {
        Jump: ["KeyW", "KeySpace", "KeyArrowUp"],
        Interact: ["KeyE"],
        Throw: ["Mouse0"],
        Click: ["Mouse0"],
        EditorMoveUp: ["KeySpace"],
        EditorMoveDown: ["KeyShiftLeft", "KeyShiftRight"],
        LookCamera: ["Mouse0"],
      },
    }),
    planckPlugin({ jitterThreshold: 6 }),
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
