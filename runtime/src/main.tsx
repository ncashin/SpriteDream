import invariant from "tiny-invariant";
import { editorPlugin } from "./editor/editorPlugin";
import { gameide } from "./initialization";
import initialScene from "./scenes/example.scene?raw";
import "./style.css";
import { threePlugin } from "./threePlugin/threePlugin";

const rootElement = document.getElementById("app");
invariant(rootElement);

gameide({
  rootElement,
  initialScene: JSON.parse(initialScene),
  additionalContext: {},
})
  .run(editorPlugin())
  .run(threePlugin());
