import {
  implementsTrait,
  defineTrait,
  getScene,
  query,
  OWNER_ID,
  gameStart,
  gameUpdate,
  update,
  $string,
} from "gameide";
import invariant from "tiny-invariant";
import type { MainContext } from "./gameConfig";

const PlayerTrait = defineTrait(
  {
    [OWNER_ID]: $string,
    x: 0,
    y: 0,
    speed: 200,
  },
  { name: "Player" },
);

function playerColor(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360} 55% 52%)`;
}

export function main({ input, networking, rootElement }: MainContext): void {
  const scene = getScene();

  gameStart(() => {
    scene.createObject(
      networking.peerId,
      networking.withOwnership({
        x: 0,
        y: 0,
        speed: 200,
      }),
    );
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

    for (const player of scene.query(implementsTrait(PlayerTrait))) {
      const px = canvas.width / 2 + player.x;
      const py = canvas.height / 2 - player.y;
      context.fillStyle = playerColor(String(player[OWNER_ID] ?? ""));
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
    for (const player of scene.query(implementsTrait(PlayerTrait))) {
      if (!networking.isOwned(player)) continue;

      const horizontal = input.axes.Horizontal;
      const vertical = input.axes.Vertical;

      player.x += horizontal * player.speed * deltaTime;
      player.y += vertical * player.speed * deltaTime;
    }
  });
}
