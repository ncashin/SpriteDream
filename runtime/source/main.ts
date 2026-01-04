import { initializePlugins, type InitialGameContext } from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { ecsEditorPlugin } from "./core/editor/ecsEditorPlugin";
import { addStartCallback } from "./core/initialization";
import { addUpdateCallback } from "./core/gameloop";

export function main(initialContext: InitialGameContext) {
  const gameContext = initializePlugins({
    initialContext,
    plugins: [ecsPlugin, spritePlugin, inputPlugin, ecsEditorPlugin],
  });

  const playerEntityId = "player";
  let playerEntity: any | null = null;
  const groundY = 500;

  addStartCallback(() => {
    playerEntity = gameContext.ecs.getEntity(playerEntityId);

    const component = document.createElement("div");
    component.textContent = "Game started!";
    gameContext.rootElement.appendChild(component);
  });

  addUpdateCallback((deltaTime: number) => {
    if (!playerEntity || !playerEntity.position || !playerEntity.velocity || !playerEntity.player) return;

    const speed = playerEntity.player.speed;
    const moveDistance = speed * deltaTime;
    const gravity = playerEntity.player.gravity;
    const jumpStrength = playerEntity.player.jumpStrength;
    const groundLevel = groundY;

    const isOnGround = playerEntity.position.y >= groundLevel;

    if (gameContext.input.isKeyPressed("a")) {
      playerEntity.position.x -= moveDistance;
    }
    if (gameContext.input.isKeyPressed("d")) {
      playerEntity.position.x += moveDistance;
    }

    if (gameContext.input.isKeyPressed(" ") && isOnGround) {
      playerEntity.velocity.y = -jumpStrength;
    }

    playerEntity.velocity.y += gravity * deltaTime;
    playerEntity.position.y += playerEntity.velocity.y * deltaTime;

    if (playerEntity.position.y >= groundLevel) {
      playerEntity.position.y = groundLevel;
      playerEntity.velocity.y = 0;
    }
  });
}
