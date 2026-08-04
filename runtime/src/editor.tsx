import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
import EditorRoot from "./EditorRoot";
import initialScene from "./scenes/example.scene?raw";
import { gameide } from "./tomove/initialization";

const rootElement = document.getElementById("app");
invariant(rootElement);

const { gameContext } = await gameide({
  rootElement,
  initialScene: JSON.parse(initialScene),
  additionalContext: {},
});

console.log(gameContext);

const editorRoot = createRoot(rootElement);
editorRoot.render(<EditorRoot gameContext={gameContext} />);
