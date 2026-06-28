import {
  editorGameModule,
  gameide,
  gameUIGameModule,
  inputGameModule,
  networkingGameModule,
} from "gameide";
import invariant from "tiny-invariant";
import exampleScene from "./scenes/example.scene";
import "./style.css";
import { Editor } from "./gameide/editor/Editor";
import { GameUI } from "./GameUI";
import main from "./game";
import { pixiGameModule } from "./gameide/gameModules/pixiGameModule/index";
import { planckGameModule } from "./gameide/gameModules/planckGameModule/index";

const rootElement = document.getElementById("app");
invariant(rootElement);

const gameContext = await gameide({
  rootElement,
  initialContext: {},
  initialScene: exampleScene,
  gameModules: [
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
    planckGameModule({}),
    pixiGameModule({}),
  ],
});

export type RuntimeGameContext = typeof gameContext;
main(gameContext);
