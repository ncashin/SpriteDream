import {
  editorPlugin,
  gameide,
  gameUIPlugin,
  inputPlugin,
  networkingPlugin,
} from "gameide";
import invariant from "tiny-invariant";
import exampleScene from "./scenes/example.scene";
import "./style.css";
import { Editor } from "./editor/Editor";
import { GameUI } from "./GameUI";
import main from "./game";
import { pixiPlugin } from "./plugins/pixiPlugin/index";
import { planckPlugin } from "./plugins/planckPlugin/index";

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
    planckPlugin(),
    pixiPlugin(),
  ],
});

export const { gameContext } = game;
export type RuntimeGameContext = typeof gameContext;
main(gameContext);
