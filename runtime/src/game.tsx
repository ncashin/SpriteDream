import invariant from "tiny-invariant";
import { inputPlugin } from "./inputPlugin/inputPlugin";
import { pixiPlugin } from "./pixiPlugin/pixiPlugin";
import initialScene from "./scenes/example.scene?raw";
import { hasComponent } from "./tomove/components";
import { gameide } from "./tomove/gameide";
import { TransformComponent } from "./tomove/transform";

console.log("GAME");

const rootElement = document.getElementById("app");
invariant(rootElement);

const { gameContext } = await gameide({
  rootElement,
  initialScene: JSON.parse(initialScene),
  additionalContext: {},
})
  .run(
    inputPlugin({
      buttons: {
        jump: ["Space"],
      },
      axes: {
        moveX: {
          positiveKeys: ["KeyD"],
          negativeKeys: ["KeyA"],
        },
      },
    }),
  )
  .run(pixiPlugin({}));

const { scene, onUpdate, input } = gameContext;

onUpdate((deltaTime) => {
  const playerObject = scene.newObject;

  if (!hasComponent(playerObject, TransformComponent)) {
    return;
  }

  playerObject.position.x += input.axis.moveX * deltaTime * 200;
});
