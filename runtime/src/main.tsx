import { gameide } from "./initialization";
import "./style.css";
import initialScene from "./scenes/example.json";
import invariant from "tiny-invariant";
import { createRoot } from "react-dom/client";
import Editor from "./Editor";
import SceneProvider from "./SceneProvider";
import { flushSync } from "react-dom";

const rootElement = document.getElementById("app");
invariant(rootElement);

gameide({
  rootElement,
  initialScene,
  additionalContext: {},
})
  .run((context) => {
    const { rootElement, scene } = context;

    const editorRoot = createRoot(rootElement);
    flushSync(() =>
      editorRoot.render(
        <SceneProvider scene={scene}>
          <Editor />
        </SceneProvider>,
      ),
    );

    const newRootElement = rootElement.querySelector("#game-view");
    invariant(newRootElement, "<GameView /> component is required in editor");

    return { ...context, rootElement: newRootElement };
  })
  .run((context) => {
    const { rootElement } = context;
    rootElement.textContent = "YOOOOOOOOOO IT WORKED THAT'S CRAZY";
    return context;
  });
