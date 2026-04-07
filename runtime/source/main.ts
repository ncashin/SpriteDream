import {
  getScene,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  editorPlugin,
  networkingPlugin,
  SCENE_OWNER_ID,
  gameUpdate,
  update,
} from "gameide";
import sampleScene from "./sample.scene";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

type Player = {
  [SCENE_OWNER_ID]?: string;
  x: number;
  y: number;
  speed: number;
};

type ScenePlayers = Record<string, Player>;

const rootElement = document.getElementById("app");
invariant(rootElement);

const networkRoomId =
  new URLSearchParams(window.location.search).get("room") ?? "default";

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

function playerColor(id: string): string {
  return `hsl(${hashHue(id)} 55% 52%)`;
}

initializeGame({
  rootElement,
  initialContext: {},
  initialScene: sampleScene,
  plugins: initializePlugins([
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    networkingPlugin({ roomId: networkRoomId }),
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
  main({ input, networking }) {
    const players = (getScene() as { players: ScenePlayers }).players;
    players[networking.peerId] = {
      x: 0,
      y: 0,
      speed: 200,
      [SCENE_OWNER_ID]: networking.peerId,
    };
    const local = players[networking.peerId];

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
    const half = playerSize / 2;

    update(() => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const id of Object.keys(players)) {
        const p = players[id];
        const px = canvas.width / 2 + p.x;
        const py = canvas.height / 2 - p.y;
        context.fillStyle = playerColor(id);
        context.fillRect(px - half, py - half, playerSize, playerSize);
      }
    });

    gameUpdate((deltaTime) => {
      const h = input.axes.Horizontal;
      const v = input.axes.Vertical;
      local.x += h * local.speed * deltaTime;
      local.y += v * local.speed * deltaTime;
    });
  },
});
