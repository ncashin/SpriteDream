import {
  getScene,
  query,
  SCENE_OWNER_ID,
  gameStart,
  gameUpdate,
  update,
  type SceneObject,
} from "gameide";
import invariant from "tiny-invariant";
import type { MainContext } from "./gameConfig";

type PlayerBody = SceneObject & {
  x: number;
  y: number;
  speed: number;
};

function isPlayer(value: unknown): value is PlayerBody {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<PropertyKey, unknown>;
  return (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.speed === "number"
  );
}

function hashHue(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}

function playerColor(id: string): string {
  return `hsl(${hashHue(id)} 55% 52%)`;
}

function playerObjectKey(peerId: string): string {
  return `player-${peerId}`;
}

export function main({
  input,
  networking,
  rootElement,
}: MainContext): void {
  const scene = getScene();

  gameStart(() => {
    scene[playerObjectKey(networking.peerId)] = networking.withOwnership({
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
  rootElement.prepend(canvas);

  const context = canvas.getContext("2d");
  invariant(context);

  window.addEventListener("resize", () => {
    canvas.width = rootElement.clientWidth;
    canvas.height = rootElement.clientHeight;
  });

  const playerSize = 32;
  const half = playerSize / 2;

  update(() => {
    context.fillStyle = "#0f1419";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const player of query(scene, isPlayer)) {
      const px = canvas.width / 2 + player.x;
      const py = canvas.height / 2 - player.y;
      context.fillStyle = playerColor(String(player[SCENE_OWNER_ID] ?? ""));
      context.fillRect(px - half, py - half, playerSize, playerSize);
    }

    context.fillStyle = "#94a3b8";
    context.font = "13px system-ui, sans-serif";
    context.fillText(
      "WASD / arrow keys to move. Open two tabs to see other players.",
      12,
      22,
    );
  });

  gameUpdate((deltaTime) => {
    for (const player of query(scene, isPlayer)) {
      if (!networking.isOwned(player)) {
        continue;
      }
      const horizontal = input.axes.Horizontal;
      const vertical = input.axes.Vertical;
      player.x += horizontal * player.speed * deltaTime;
      player.y += vertical * player.speed * deltaTime;
    }
  });
}
