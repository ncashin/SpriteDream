import {
  game,
  inputPlugin,
  editorPlugin,
  networkingPlugin,
  gameUIPlugin,
  pixiPlugin,
} from "gameide";
import { loadScenes } from "virtual:gameide-scenes";
import { loadAssets } from "virtual:gameide-assets";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";
import { main } from "./main";

const rootElement = document.getElementById("app");
invariant(rootElement);

const scenes = loadScenes();

const mainFunction = game({
  rootElement,
  initialContext: {},
  initialScene: scenes["source/sample.scene"],
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
          negative: ["KeyA"],
          positive: ["KeyD"],
        },
        Vertical: {
          negative: ["KeyS"],
          positive: ["KeyW"],
        },
      },
      buttons: {
        EditorMoveUp: ["KeySpace"],
        EditorMoveDown: ["KeyShiftLeft", "KeyShiftRight"],
        LookCamera: ["Mouse0"],
      },
    }),
    pixiPlugin({
      initOptions: {
        backgroundAlpha: 0,
      },
      assets: loadAssets(),
    }),
  ],
});

export type MainContext = Parameters<Parameters<typeof mainFunction>[0]>[0];

void mainFunction(main);
