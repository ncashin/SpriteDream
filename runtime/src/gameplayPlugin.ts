import { hasComponent } from "./components";
import type { GameContext } from "./initialization";
import { TransformComponent } from "./transform";

export const gameplay = () => async (context: GameContext) => {
  const { scene, onUpdate } = context;

  onUpdate(() => {
    const playerObject = scene.newObject;

    if (!hasComponent(playerObject, TransformComponent)) {
      return;
    }
  });

  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      if (!newModule?.gameplay) return;
      context.__run.rerun(newModule.gameplay());
    });
  }

  return context;
};
