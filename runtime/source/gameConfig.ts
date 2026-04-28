import {
  game,
  inputPlugin,
  editorPlugin,
  networkingPlugin,
  gameUIPlugin,
  pixiPlugin,
  planckPlugin,
} from "gameide";
import sampleScene from "./sample.scene";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";
import { main } from "./main";

const rootElement = document.getElementById("app");
invariant(rootElement);

const mainFunction = game({
  rootElement,
  initialContext: {},
  initialScene: sampleScene,
  plugins: [
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    networkingPlugin({
      room: "default",
      url: "ws://localhost:5174/room",
    }),
    inputPlugin({
      axes: {
        Horizontal: {
          negative: ["KeyA", "KeyArrowLeft"],
          positive: ["KeyD", "KeyArrowRight"],
        },
      },
      buttons: {
        Jump: ["KeyW", "KeySpace", "KeyArrowUp"],
        EditorMoveUp: ["KeySpace"],
        EditorMoveDown: ["KeyShiftLeft", "KeyShiftRight"],
        LookCamera: ["Mouse0"],
      },
    }),
    pixiPlugin({
      initOptions: {
        backgroundAlpha: 0,
      },
      debugDrawColliders: true,
    }),
    planckPlugin(),
  ],
});

export type MainContext = Parameters<Parameters<typeof mainFunction>[0]>[0];

void mainFunction(main);
