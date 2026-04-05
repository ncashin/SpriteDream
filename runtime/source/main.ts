import {
  queryObject,
  gameUpdate,
  getScene,
  defineObject,
  createObjectGuard,
  gameUIPlugin,
  initializeGame,
  initializePlugins,
  inputPlugin,
  editorPlugin,
} from "gameide";
import sampleScene from "./sample.scene";
import "./style.css";
import invariant from "tiny-invariant";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

const PlayerDefinition = defineObject(
  {
    transform2D: {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    sprite: {
      image: "",
      tint: "rgba(255,255,255,1)",
      width: 0,
      height: 0,
    },
    speed: 200,
  },
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
    inputPlugin({
      axes: {
        Horizontal: {
          negative: ["KeyA", "KeyArrowLeft"],
          positive: ["KeyD", "KeyArrowRight"],
        },
        Vertical: {
          negative: ["KeyS", "KeyArrowDown"],
          positive: ["KeyW", "KeyArrowUp"],
        },
      },
      buttons: {
        Jump: ["KeySpace"],
      },
    }),
  ]),
  main({ input }) {
    const scene = getScene();
    const isPlayer = createObjectGuard(PlayerDefinition);

    gameUpdate((deltaTime) => {
      const players = queryObject(scene, isPlayer);

      const h = input.axes.Horizontal;

      players.forEach((player) => {
        player.transform2D.x += h * player.speed * deltaTime;
      });
    });
  },
});
