import { hasComponent } from "./components";
import type { GameContext } from "./initialization";
import { TransformComponent } from "./transform";

export const main = async (context: GameContext) => {
  const { scene, onUpdate } = context;

  onUpdate(() => {
    const playerObject = scene.newObject;

    if (!hasComponent(playerObject, TransformComponent)) {
      return;
    }

    const time = performance.now() / 1000;

    const radius = 200;

    playerObject.position.x = Math.cos(time) * radius;
    playerObject.position.y = Math.sin(time) * radius;
  });

  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      if (!newModule?.main) return;
      context.__run.rerun(newModule.main);
    });
  }

  return context;
};
