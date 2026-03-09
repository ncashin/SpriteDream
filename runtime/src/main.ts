import {
  gameUpdate,
  getScene,
  createPlugins,
  defineObject,
  $number,
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

const PlayerDefinition = defineObject(
  { x: $number, y: 0, size: 24, speed: 200 },
  { name: "Player", description: "PlayerEntity" }
);

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
  main({ input, render2D }) {
    const { canvasElement, context } = render2D;
    const scene = getScene();

    gameUpdate((deltaTime) => {
      const player = scene.player;
      if (!PlayerDefinition.guard(player)) return;

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
      if (!PlayerDefinition.guard(player)) return;

      const canvasW = canvasElement.clientWidth;
      const canvasH = canvasElement.clientHeight;

      context.clearRect(0, 0, canvasW, canvasH);
      context.fillStyle = "#0000ff";
      context.fillRect(player.x, player.y, player.size, player.size);
    });
  },
});
