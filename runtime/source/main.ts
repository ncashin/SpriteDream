import { initializePlugins, type InitialGameContext } from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { SpriteComponentDefinition, spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { PositionComponentDefinition, VelocityComponentDefinition } from "./core/ecs/defaultComponents";
import { addStartCallback } from "./core/initialization";
import { addUpdateCallback } from "./core/gameloop";

export function main(initialContext: InitialGameContext) {
  const gameContext = initializePlugins({
    initialContext,
    plugins: [ecsPlugin, spritePlugin, inputPlugin],
  });

  const playerEntityId = "player";
  let player: any | null = null;
  const groundY = 700;

  addStartCallback(() => {
    player = gameContext.ecs.getEntity(playerEntityId);

    const component = document.createElement("div");
    component.textContent = "Game started!";
    gameContext.rootElement.appendChild(component);
  });

  addUpdateCallback((deltaTime: number) => {
    if (!player || !player.position || !player.velocity) return;

    const speed = 200;
    const moveDistance = speed * deltaTime;
    const gravity = 1800;
    const jumpStrength = 350;
    const groundLevel = groundY;

    const isOnGround = player.position.y >= groundLevel;

    if (gameContext.input.isKeyPressed("a")) {
      player.position.x -= moveDistance;
    }
    if (gameContext.input.isKeyPressed("d")) {
      player.position.x += moveDistance;
    }

    if (gameContext.input.isKeyPressed(" ") && isOnGround) {
      player.velocity.y = -jumpStrength;
    }

    player.velocity.y += gravity * deltaTime;
    player.position.y += player.velocity.y * deltaTime;

    if (player.position.y >= groundLevel) {
      player.position.y = groundLevel;
      player.velocity.y = 0;
    }
  });
}
