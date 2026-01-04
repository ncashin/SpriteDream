import { initializePlugins, type InitialGameContext } from "./core/gameContext";
import {  ecsPlugin } from "./core/scene/ecsAdapter";
import { SpriteComponentDefinition, spritePlugin } from "./core/sprite";
import { PositionComponentDefinition } from "./core/ecs/defaultComponents";

export function main(initialContext: InitialGameContext) {
  const gameContext = initializePlugins({
    initialContext,
    plugins: [ecsPlugin, spritePlugin],
  });

  const spriteEntity = gameContext.ecs.createEntity();

  gameContext.ecs.addComponent(spriteEntity, {
    ...PositionComponentDefinition,
    x: 400,
    y: 300,
  });

  gameContext.ecs.addComponent(spriteEntity, {
    ...SpriteComponentDefinition,
    width: 64,
    height: 64,
    color: "#ff6b6b",
  });

  const component = document.createElement("div");
  component.textContent = "Game started!";
  gameContext.rootElement.appendChild(component);
  console.log("HERE");
}
