import {
  editorGameModule,
  gameUIGameModule,
  inputGameModule,
  networkingGameModule,
  type GameContext,
} from "gameide";
import { Editor } from "./gameide/editor/Editor";
import { GameUI } from "./GameUI";
import { pixiGameModule } from "./gameide/gameModules/pixiGameModule/index";
import { planckGameModule } from "./gameide/gameModules/planckGameModule/index";
import { sceneHierarchyGameModule } from "./gameide/gameModules/sceneHierarchy";

export const initialContext = {};

export const pluginGameModules = [
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
] as const;

export type MainGameContext = GameContext<
  typeof initialContext,
  typeof pluginGameModules
>;
