import "./style.css";
import invariant from "tiny-invariant";
import { initializeGame } from "./runtime/initializeGame";
import { editorPlugin } from "./editor/editorPlugin";
import { render2DPlugin } from "./render2D/render2DPlugin";
import { getScene } from "./scene/scene";
import { SpriteDefinition } from "./render2D/sprite";
import { instantiateObject } from "./scene/objectDefinition";

const __gameRoot = document.getElementById("game");
invariant(__gameRoot, "#game element must exist in the DOM");

await initializeGame({
  initialContext: { __gameRoot, __isRunning: false },
  plugins: [editorPlugin(), render2DPlugin()],
  main: () => {
    const scene = getScene();
    scene.typescriptLogo = instantiateObject(SpriteDefinition, {
      transform2D: {
        x: 100,
        y: 100,
      },
      sprite: {
        image: "/src/typescript.svg",
        width: 32,
        height: 32,
      },
    });
  },
});
