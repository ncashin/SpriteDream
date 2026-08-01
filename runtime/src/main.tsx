import invariant from "tiny-invariant";
import { editorPlugin } from "./editor/editorPlugin";
import { main } from "./gamingPlugin";
import { gameide } from "./initialization";
import { pixiPlugin } from "./pixiPlugin/pixiPlugin";
import initialScene from "./scenes/example.scene?raw";
import "./style.css";

const rootElement = document.getElementById("app");
invariant(rootElement);

gameide({
  rootElement,
  initialScene: JSON.parse(initialScene),
  additionalContext: {},
})
  .run(editorPlugin())
  .run(pixiPlugin({}))
  .run(main);
