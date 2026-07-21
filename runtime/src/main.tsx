import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";
import Editor from "./editor/Editor";
import GameViewReadyProvider from "./editor/GameViewReadyProvider";
import SceneProvider from "./editor/SceneProvider";
import { gameide } from "./initialization";
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
          <SceneProvider scene={scene}>
            <GameViewReadyProvider onReady={markGameViewReady}>
              <Suspense fallback={<div>Loading...</div>}>
                <Editor />
              </Suspense>
            </GameViewReadyProvider>
          </SceneProvider>
        </QueryClientProvider>,
      ),
    );

    await gameViewReady;
    const newRootElement = rootElement.querySelector("#game-view");
    invariant(newRootElement, "A <GameView /> Component Must Be Rendered In Editor");

    return { ...context, rootElement: newRootElement };
  })
  .run((context) => {
    const { rootElement } = context;
    rootElement.textContent = "Game View Root Element";
    return context;
  });

if (import.meta.hot) {
  import.meta.hot.on("gameide:scene", ({ file }) => {
    console.log("Scene HMR Event:", file);
  });
}
