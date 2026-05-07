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
import typescriptSvgUrl from "../assets/typescript.svg?url";
import "./style.css";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";
await import("./game.ts");


const rootElement = document.getElementById("app");
invariant(rootElement);

export const { gameContext } = await gameide({
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
      buttons: {
        Jump: ["KeyW", "KeySpace", "KeyArrowUp"],
        Interact: ["KeyE"],
        Throw: ["Mouse0"],
        EditorMoveUp: ["KeySpace"],
        EditorMoveDown: ["KeyShiftLeft", "KeyShiftRight"],
        LookCamera: ["Mouse0"],
      },
    }),
    planckPlugin(),
    pixiPlugin({
      initOptions: {
        backgroundAlpha: 0,
      },
      debugDrawColliders: true,
      assets: {
        "assets/typescript.svg": typescriptSvgUrl,
      },
    }),
  ],
});