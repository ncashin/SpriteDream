import {
  editorGameModule,
  gameide,
  gameUIGameModule,
  inputGameModule,
  networkingGameModule,
  saveGameModule,
  type GameContext,
} from "gameide";
import invariant from "tiny-invariant";
import exampleScene from "./scenes/example.scene";
import "./style.css";
import { Editor } from "./gameide/editor/Editor";
import { GameUI } from "./GameUI";
import main from "./main";
import { pixiGameModule } from "./gameide/gameModules/pixiGameModule/index";
import { planckGameModule } from "./gameide/gameModules/planckGameModule/index";
import { sceneHierarchyGameModule } from "./gameide/gameModules/sceneHierarchy";

const rootElement = document.getElementById("app");
invariant(rootElement);

const initialContext = {};
const pluginGameModules = [
  editorGameModule(Editor),
  gameUIGameModule(GameUI),
  networkingGameModule(),
  inputGameModule({
    axes: {
      Horizontal: {
        negative: ["KeyA", "KeyArrowLeft"],
        positive: ["KeyD", "KeyArrowRight"],
      },
    },
    mouseHandling: "editor",
    buttons: {
      Jump: ["KeyW", "KeySpace", "KeyArrowUp"],
      Interact: ["KeyE"],
      Throw: ["Mouse0"],
      Click: ["Mouse0"],
      EditorMoveUp: ["KeySpace"],
      EditorMoveDown: ["KeyShiftLeft", "KeyShiftRight"],
      LookCamera: ["Mouse0"],
    },
  }),
  sceneHierarchyGameModule,
  planckGameModule({}),
  pixiGameModule({}),
  saveGameModule({ highScore: 0 }),
] as const;

export type MainGameContext = GameContext<
  typeof initialContext,
  typeof pluginGameModules
>;

gameide({
  rootElement,
  initialContext: {},
  initialScene: exampleScene,
  gameModules: [...pluginGameModules, main],
});
