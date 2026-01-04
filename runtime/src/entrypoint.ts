import { initializePlugins, type InitialGameContext } from "./core/gameContext";
import { initializeSceneECS } from "./core/scene/ecsAdapter";

export function main(initialContext: InitialGameContext) {
  const gameContext = initializePlugins({
    initialContext,
    plugins: [initializeSceneECS],
  });

  const component = document.createElement("div");
  component.textContent = "Game started!";
  gameContext.rootElement.appendChild(component);
  console.log("HERE");
}
