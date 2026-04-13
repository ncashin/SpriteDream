import {
  getScene,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  editorPlugin,
  networkingPlugin,
  SCENE_OWNER_ID,
  gameStart,
  gameUpdate,
  update,
  type SceneObjectData,
  isOwned,
} from "gameide";
import sampleScene from "./sample.scene";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

const rootElement = document.getElementById("app");
invariant(rootElement);

type PlayerBody = SceneObjectData & {
  x: number;
  y: number;
  speed: number;
} & Partial<Record<typeof SCENE_OWNER_ID, string>>;

const isPlayer = (gameObject: SceneObjectData): gameObject is PlayerBody =>
  typeof gameObject.x === "number" &&
  typeof gameObject.y === "number" &&
  typeof gameObject.speed === "number";


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
    networkingPlugin({
      roomId: "default",
      peerConnectTimeoutMilliseconds: 1000,
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
      buttons: {
        Jump: ["KeySpace"],
      },
    }),
  ]),
  main({ input, networking }) {
    const scene = getScene();

    gameStart(() => {
      scene.createObject(networking.peerId, {
        [SCENE_OWNER_ID]: networking.peerId,
        x: 0,
        y: 0,
        speed: 200,
      });
    });

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
      for (const player of scene.query(isPlayer)) {
        const px = canvas.width / 2 + player.x;
        const py = canvas.height / 2 - player.y;
        context.fillStyle = playerColor(player[SCENE_OWNER_ID] ?? "");
        context.fillRect(px - half, py - half, playerSize, playerSize);
      }
    });

    gameUpdate((deltaTime) => {
      for (const player of scene.query(isPlayer)) {
        if (!isOwned(networking.peerId, player)) {
          continue;
        }
        const h = input.axes.Horizontal;
        const v = input.axes.Vertical;
        player.x += h * player.speed * deltaTime;
        player.y += v * player.speed * deltaTime;
      }
    });
  },
});
