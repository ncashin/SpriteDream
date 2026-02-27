import "./style.css";
import { initializeGame } from "./runtime/initializeGame";
import { gameUpdate } from "./runtime/gameloop";
import { render2DPlugin } from "./render2D/render2DPlugin";
import { getScene } from "./scene/scene";
import { SpriteDefinition } from "./render2D/sprite";
import { instantiateObject } from "./scene/objectDefinition";
import { inputPlugin } from "./input/inputPlugin";

const PLAYER_SPEED = 1000;

await initializeGame({
  plugins: [inputPlugin(), render2DPlugin()],
  main: (context) => {
    const scene = getScene();
    scene.player = instantiateObject(SpriteDefinition, {
      transform2D: {
        x: 200,
        y: 200,
      },
      sprite: {
        image: "/src/typescript.svg",
        width: 32,
        height: 32,
      },
    });

    gameUpdate((deltaMs) => {
      const player = getScene().player as
        | { transform2D: { x: number; y: number } }
        | undefined;
      if (!player) return;
      const d = (deltaMs / 1000) * PLAYER_SPEED;
      if (context.input.keyboard.isDown("KeyW")) player.transform2D.y += d;
      if (context.input.keyboard.isDown("KeyS")) player.transform2D.y -= d;
      if (context.input.keyboard.isDown("KeyA")) player.transform2D.x -= d;
      if (context.input.keyboard.isDown("KeyD")) player.transform2D.x += d;
    });
  },
});
