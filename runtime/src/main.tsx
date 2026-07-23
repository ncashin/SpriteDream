import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
import Editor from "./editor/Editor";
import GameViewReadyProvider from "./editor/GameViewReadyProvider";
import GameIDEContextProvider from "./editor/SceneProvider";
import { gameide } from "./initialization";
import { patchScene } from "./scene";
import initialScene from "./scenes/example.scene?raw";
import "./style.css";

const rootElement = document.getElementById("app");
invariant(rootElement);

gameide({
  rootElement,
  initialScene: JSON.parse(initialScene),
  additionalContext: {},
})
  .run(async (context) => {
    const { rootElement, scene } = context;

    const queryClient = new QueryClient();

    const editorRoot = createRoot(rootElement);

    let markGameViewReady!: () => void;

    const gameViewReady = new Promise<void>((resolve) => {
      markGameViewReady = resolve;
    });

    flushSync(() =>
      editorRoot.render(
        <QueryClientProvider client={queryClient}>
          <GameIDEContextProvider gameContext={context}>
            <GameViewReadyProvider onReady={markGameViewReady}>
              <Suspense fallback={<div>Loading...</div>}>
                <Editor />
              </Suspense>
            </GameViewReadyProvider>
          </GameIDEContextProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>,
      ),
    );

    await gameViewReady;
    const newRootElement = rootElement.querySelector("#game-view");
    invariant(newRootElement, "A <GameView /> Component Must Be Rendered In Editor");

    if (import.meta.hot) {
      import.meta.hot.on("gameide:scene", ({ file, content, patch }) => {
        const queryKey = ["files", file];
        queryClient.setQueryData(queryKey, {
          content,
        });
        queryClient.invalidateQueries({ queryKey });

        patchScene(scene, patch);
      });
    }

    return { ...context, rootElement: newRootElement };
  })
  .run((context) => {
    const { rootElement, scene, onUpdate } = context;
    rootElement.textContent = "Game View Root Element";

    onUpdate(() => {
      if (scene.rerenderTest === undefined || !(typeof scene.rerenderTest === "number")) {
        scene.rerenderTest = 0;
        return;
      }
    });

    return context;
  });
