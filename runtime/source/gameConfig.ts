import {
  game,
  plugins,
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

const boundGame = game({
  rootElement,
  initialContext: {},
  initialScene: sampleScene,
  plugins: plugins([
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    networkingPlugin({
      room: "default",
      url: "ws://localhost:5173/room",
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
  ]),
});

export type MainContext = Parameters<Parameters<typeof boundGame>[0]>[0];

void boundGame(main);
