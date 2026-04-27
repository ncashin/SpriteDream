import {
  game,
  inputPlugin,
  editorPlugin,
  networkingPlugin,
  gameUIPlugin,
  threePlugin,
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
        EditorHorizontal: {
          negative: ["KeyA"],
          positive: ["KeyD"],
        },
        EditorVertical: {
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
    threePlugin({
      clearColor: 0x0f1419,
      assets: loadAssets(),
      camera: {
        z: 8,
      },
      editorCamera: true,
    }),
  ],
});

export type MainContext = Parameters<Parameters<typeof mainFunction>[0]>[0];

void mainFunction(main);
