import {
  game,
  inputPlugin,
  editorPlugin,
  networkingPlugin,
  gameUIPlugin,
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
        Vertical: {
          negative: ["KeyS", "KeyArrowDown"],
          positive: ["KeyW", "KeyArrowUp"],
        },
      },
      buttons: {},
    }),
  ],
});

export type MainContext = Parameters<Parameters<typeof mainFunction>[0]>[0];

void mainFunction(main);
