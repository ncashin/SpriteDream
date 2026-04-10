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

const rootElement = document.getElementById("app");
invariant(rootElement);

const search = new URLSearchParams(window.location.search);
const networkRoomId = search.get("room") ?? "default";
const gameIdFromPath = (() => {
  const match = window.location.pathname.match(/^\/game\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
})();
const networkGameId =
  search.get("game") ??
  gameIdFromPath ??
  "dev";
const signalingURL = `https://gameide.app/game/57ed7ee4-55c0-49f3-9c13-fc83e3b9f964/webrtc-signal`;

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
      roomId: networkRoomId,
      signalingURL,
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
    const scene = getScene() as any;
    if(!scene.players) {
      scene.players = {};
    }
    const players = scene.players;
    const localPlayer = players.createObject(networking.peerId, {
      [SCENE_OWNER_ID]: networking.peerId,
      x: 0,
      y: 0,
      speed: 200,
    })
 

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
        const player = players[id];
        const px = canvas.width / 2 + player.x;
        const py = canvas.height / 2 - player.y;
        context.fillStyle = playerColor(id);
        context.fillRect(px - half, py - half, playerSize, playerSize);
      }
    });

    gameUpdate((deltaTime) => {
      const h = input.axes.Horizontal;
      const v = input.axes.Vertical;
      localPlayer.x += h * localPlayer.speed * deltaTime;
      localPlayer.y += v * localPlayer.speed * deltaTime;
    });
  },
});
