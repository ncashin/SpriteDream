import "./style.css";
import { initializeGame } from "./runtime/initializeGame";
import { editorPlugin } from "./editor/editorPlugin";
import { render2DPlugin } from "./render2D/render2DPlugin";
import { getScene } from "./scene/scene";
import { SpriteDefinition } from "./render2D/sprite";
import { instantiateObject } from "./scene/objectDefinition";

initializeGame({
  plugins: [editorPlugin(), render2DPlugin()],
  main: () => {
    const scene = getScene();
    scene.typescriptLogo1 = instantiateObject(SpriteDefinition, {
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

    scene.typescriptLogo2 = instantiateObject(SpriteDefinition, {
      transform2D: {
        x: 150,
        y: 100,
      },
      sprite: {
        image: "/src/typescript.svgso",
        width: 32,
        height: 32,
      },
    });
  },
});
