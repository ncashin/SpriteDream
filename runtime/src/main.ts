import "./style.css";
import { initializeGame } from "./runtime/initializeGame";
import { Editor } from "./editor/Editor";
import { Game } from "./editor/Game";
import { render2DPlugin } from "./render2D/render2DPlugin";
import { getScene } from "./scene/scene";
import { SpriteDefinition } from "./render2D/sprite";
import { instantiateObject } from "./scene/objectDefinition";

await initializeGame({
  Editor,
  Game,
  plugins: [render2DPlugin()],
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
