import { initializeGame } from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { viewportPlugin } from "./core/viewport/viewportPlugin";
import { collisionPlugin } from "./core/collision/collisionPlugin";
import { ecsEditorPlugin } from "./core/ecs/editor/ECSEditorPlugin";
import { initializePlayer } from "./scripts/main";
import "./scripts/weapon";
import initialScene from "../scenes/default.scene?raw";

export {
  getViewport,
  setViewport,
  updateViewport,
  resetViewport,
  setViewportScale,
  zoomViewport,
} from "./core/viewport/viewportPlugin";

initializeGame({
  plugins: [
    inputPlugin,
    viewportPlugin,
    ecsPlugin,
    spritePlugin,
    collisionPlugin,
    ecsEditorPlugin,
  ],
  initialScene,
  onInit: (context) => {
    initializePlayer(context, "player");
  },
});
