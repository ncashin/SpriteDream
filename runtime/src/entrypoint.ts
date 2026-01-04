import { initializePlugins, type InitialGameContext } from "./core/gameContext";
import { sceneECSPlugin as sceneECSPlugin } from "./core/scene/ecsAdapter";

export function main(initialContext: InitialGameContext) {
  const gameContext = initializePlugins({
    initialContext,
    plugins: [sceneECSPlugin],
  });

  const entity = gameContext.ecs.createEntity();
  const testComponent = { type: "TestComponent", foo: 42, bar: "baz" };
  gameContext.ecs.addComponent(entity, testComponent);

  const component = document.createElement("div");
  component.textContent = "Game started!";
  gameContext.rootElement.appendChild(component);
  console.log("HERE");
}
