import { gameUpdate } from "./gameloop";
import { initializeGame } from "./initializeGame";
import { inputPlugin } from "./inputPlugin";
import { render2DPlugin } from "./render2DPlugin";
import { getScene } from "./scene";
import sceneData from "./scene.json";
import "./style.css";
import invariant from "tiny-invariant";

const rootElement = document.getElementById("app");
invariant(rootElement);

initializeGame({
  initialContext: {
    rootElement,
  },
  initialScene: sceneData,
  plugins: [inputPlugin(), render2DPlugin()],
  main(gameContext) {
    const { render2D, input, rootElement } = gameContext;
    const { canvasElement, context } = render2D;
    const scene = getScene();

    rootElement.tabIndex = 0;
    rootElement.style.outline = "none";
    rootElement.addEventListener("mousedown", () => rootElement.focus());
    rootElement.focus();

    gameUpdate((deltaTime) => {
      const player = scene.player as any;
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

      context.clearRect(0, 0, canvasW, canvasH);
      context.fillStyle = "#3b82f6";
      context.fillRect(player.x, player.y, player.size, player.size);
    });
  },
});
