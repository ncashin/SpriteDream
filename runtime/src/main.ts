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
    const { render2D, input } = gameContext;
    const { canvasElement, context } = render2D;
    const scene = getScene();

    gameUpdate(() => {
      const player = scene.player as any;
      const h = input.getAxis("Horizontal");
      const v = input.getAxis("Vertical");
      player.x += h * player.speed * (1 / 60);
      player.y -= v * player.speed * (1 / 60);

      const maxX = canvasElement.width - player.size;
      const maxY = canvasElement.height - player.size;
      player.x = Math.max(0, Math.min(maxX, player.x));
      player.y = Math.max(0, Math.min(maxY, player.y));

      context.clearRect(0, 0, canvasElement.width, canvasElement.height);
      context.fillStyle = "#3b82f6";
      context.fillRect(player.x, player.y, player.size, player.size);
    });
  },
});
