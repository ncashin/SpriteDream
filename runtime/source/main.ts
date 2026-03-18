import {
  gameUpdate,
  getScene,
  defineObject,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  renderPlugin2D,
  update,
  editorPlugin,
} from "gameide";
import sampleScene from "./sample.scene";
import inputConfig from "./input.config.json";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

const PlayerDefinition = defineObject(
  { x: 0, y: 0, size: 24, speed: 200 },
  { name: "Player", description: "PlayerEntity" },
);

const rootElement = document.getElementById("app");
invariant(rootElement);

initializeGame({
  rootElement,
  initialContext: {},
  initialScene: sampleScene,
  plugins: initializePlugins([
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    inputPlugin(inputConfig),
    renderPlugin2D(),
  ]),
  main({ input, render2D }) {
    const { canvasElement, context } = render2D;
    const scene = getScene();

    gameUpdate((deltaTime) => {
      const players = scene.query(PlayerDefinition.guard);

      const h = input.getAxis("Horizontal");
      const v = input.getAxis("Vertical");
      const canvasW = canvasElement.clientWidth;
      const canvasH = canvasElement.clientHeight;

      players.forEach((player) => {
        player.x += h * player.speed * deltaTime;
        player.y -= v * player.speed * deltaTime;

        const maxX = canvasW - player.size;
        const maxY = canvasH - player.size;
        player.x = Math.max(0, Math.min(maxX, player.x));
        player.y = Math.max(0, Math.min(maxY, player.y));
      });
    });

    update(() => {
      const players = scene.query(PlayerDefinition.guard);

      const canvasW = canvasElement.clientWidth;
      const canvasH = canvasElement.clientHeight;

      context.clearRect(0, 0, canvasW, canvasH);

      players.forEach((player) => {
        context.fillStyle = "#0000ff";
        context.fillRect(player.x, player.y, player.size, player.size);
      });
    });
  },
});
