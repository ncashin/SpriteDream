import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
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
    const { rootElement, scene: gameideScene, onUpdate } = context;

    const threeScene = new Scene();

    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new WebGLRenderer();
    renderer.setSize(rootElement.clientWidth, rootElement.clientHeight);
    rootElement.appendChild(renderer.domElement);

    renderer.render(threeScene, camera);

    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial({ color: 0x00ff00 });

    const cube = new Mesh(geometry, material);
    threeScene.add(cube);

    onUpdate(() => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;

      renderer.render(threeScene, camera);
    });

    return context;
  });
