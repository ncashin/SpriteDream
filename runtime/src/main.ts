import {
  gameUpdate,
  getScene,
  createPlugins,
  editorPlugin,
  initializeGame,
  inputPlugin,
  render2DPlugin,
} from "gameide";
import initialScene from "../public/sample.scene";
import inputConfig from "../public/input.config.json";
import "./style.css";
import invariant from "tiny-invariant";
import { update } from "gameide/gameloop";

const PLAYER_KEYS = ["x", "y", "size", "speed"] as const;
type Player = { x: number; y: number; size: number; speed: number };

function isPlayer(obj: unknown): obj is Player {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return PLAYER_KEYS.every(
    (k) => typeof o[k] === "number" && Number.isFinite(o[k] as number),
  );
}

const rootElement = document.getElementById("app");
invariant(rootElement);

initializeGame({
  initialContext: {
    rootElement,
  },
  initialScene,
  plugins: createPlugins([
    editorPlugin(),
    inputPlugin(inputConfig),
    render2DPlugin(),
  ]),
  main({ render2D, input }) {
    const { canvasElement, context } = render2D;
    const scene = getScene();

    gameUpdate((deltaTime) => {
      const player = scene.player;
      if (!isPlayer(player)) return;

      const h = input.getAxis("Horizontal");
      const v = input.getAxis("Vertical");
      player.x += h * player.speed * deltaTime;
      player.y -= v * player.speed * deltaTime;

      const canvasW = canvasElement.clientWidth;
      const canvasH = canvasElement.clientHeight;
      const maxX = canvasW - player.size;
      const maxY = canvasH - player.size;
      player.x = Math.max(0, Math.min(maxX, player.x));
      player.y = Math.max(0, Math.min(maxY, player.y));
    });

    update(() => {
      const player = scene.player;
      if (!isPlayer(player)) return;

      const canvasW = canvasElement.clientWidth;
      const canvasH = canvasElement.clientHeight;

      context.clearRect(0, 0, canvasW, canvasH);
      context.fillStyle = "#0000ff";
      context.fillRect(player.x, player.y, player.size, player.size);
    });
  },
});
