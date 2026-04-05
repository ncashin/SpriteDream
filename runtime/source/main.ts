import {
  getScene,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  editorPlugin,
  gameUpdate,
  update,
} from "gameide";
import sampleScene from "./sample.scene";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

type Player = { x: number; y: number; speed: number };

const rootElement = document.getElementById("app");
invariant(rootElement);

initializeGame({
  rootElement,
  initialContext: {},
  initialScene: sampleScene,
  plugins: initializePlugins([
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
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
      buttons: {
        Jump: ["KeySpace"],
      },
    }),
  ]),
  main({ input }) {
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.width = rootElement.clientWidth;
    canvas.height = rootElement.clientHeight;
    canvas.style.display = "block";
    rootElement.appendChild(canvas);

    const context = canvas.getContext("2d");
    invariant(context);

    window.addEventListener("resize", () => {
      canvas.width = rootElement.clientWidth;
      canvas.height = rootElement.clientHeight;
    });

    const playerSize = 32;

    const player = (): Player => getScene().player as Player;

    update(() => {
      const p = player();
      context.clearRect(0, 0, canvas.width, canvas.height);
      const px = canvas.width / 2 + p.x;
      const py = canvas.height / 2 - p.y;
      context.fillStyle = "#4ecca3";
      const half = playerSize / 2;
      context.fillRect(px - half, py - half, playerSize, playerSize);
    });

    gameUpdate((deltaTime) => {
      const p = player();
      const h = input.axes.Horizontal;
      const v = input.axes.Vertical;
      p.x += h * p.speed * deltaTime;
      p.y += v * p.speed * deltaTime;
    });
  },
});
