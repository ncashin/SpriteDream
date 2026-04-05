import {
  collectSceneObjects,
  gameUpdate,
  getScene,
  defineObject,
  createObjectGuard,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  renderPlugin2D,
  editorPlugin,
  SpriteDefinition,
  TransformDefinition2D,
} from "gameide";
import sampleScene from "./sample.scene";
import inputConfig from "./input.config.json";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

const PlayerDefinition = defineObject(
  [TransformDefinition2D, SpriteDefinition, { speed: 200 }],
  {
    name: "Player",
    description: "PlayerEntity",
  },
);

const rootElement = document.getElementById("app");
invariant(rootElement);

initializeGame({
  rootElement,
  initialContext: {}, 
  initialScene: sampleScene,
  plugins: initializePlugins([
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    inputPlugin(inputConfig),
    renderPlugin2D(),
  ]),
  main({ input }) {
    const scene = getScene();
    const isPlayer = createObjectGuard(PlayerDefinition);

    gameUpdate((deltaTime) => {
      const players = collectSceneObjects(scene, isPlayer);

      const h = input.getAxis("Horizontal");

      players.forEach((player) => {
        player.transform2D.x += h * player.speed * deltaTime;
      });
    });
  },
});
