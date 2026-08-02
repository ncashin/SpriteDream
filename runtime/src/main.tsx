import invariant from "tiny-invariant";
import { hasComponent } from "./components";
import { editorPlugin } from "./editor/editorPlugin";
import { gameide } from "./initialization";
import { inputPlugin } from "./inputPlugin/inputPlugin";
import { pixiPlugin } from "./pixiPlugin/pixiPlugin";
import initialScene from "./scenes/example.scene?raw";
import "./style.css";
import { TransformComponent } from "./transform";

const rootElement = document.getElementById("app");
invariant(rootElement);

gameide({
  rootElement,
  initialScene: JSON.parse(initialScene),
  additionalContext: {},
})
  .run(editorPlugin())
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
  .run(pixiPlugin({}))
  .run((context) => {
    const { scene, onUpdate, input } = context;

    onUpdate((deltaTime) => {
      const playerObject = scene.newObject;

      if (!hasComponent(playerObject, TransformComponent)) {
        return;
      }

      playerObject.position.x += input.axis.moveX * deltaTime * 200;
    });

    if (import.meta.hot) {
      import.meta.hot.accept((newModule) => {
        if (!newModule?.gameplay) return;
        context.__run.rerun(newModule.gameplay());
      });
    }

    return context;
  });
