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
import { hasComponent } from "./component";
import Editor from "./editor/Editor";
import ReadyProvider from "./editor/ReadyProvider";
import GameIDEContextProvider from "./editor/SceneProvider";
import { gameide } from "./initialization";
import { patchScene, query } from "./scene";
import initialScene from "./scenes/example.scene?raw";
import "./style.css";
import { createDebugCamera } from "./threePlugin/editorCamera";
import { MeshComponent, syncMeshComponent } from "./threePlugin/mesh";
import { TransformComponent } from "./threePlugin/transform";

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

    const { promise: ready, resolve: markReady } = Promise.withResolvers<void>();

    flushSync(() =>
      editorRoot.render(
        <QueryClientProvider client={queryClient}>
          <GameIDEContextProvider gameContext={context}>
            <ReadyProvider onReady={markReady}>
              <Suspense fallback={<div>Loading...</div>}>
                <Editor />
              </Suspense>
            </ReadyProvider>
          </GameIDEContextProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>,
      ),
    );

    await ready;
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

    return { ...context, rootElement: newRootElement, ready, markReady };
  })
  .run((context) => {
    const { isEditor, rootElement, scene: gameideScene, onUpdate } = context;

    const threeScene = new Scene();
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    rootElement.appendChild(renderer.domElement);

    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    if (isEditor) {
      const debugCamera = createDebugCamera(camera, renderer.domElement);
      onUpdate(debugCamera.update);
    }

    const meshMap = new Map<object, Mesh>();

    const createMeshForGameObject = (gameObject: object) => {
      const geometry = new BoxGeometry();
      const material = new MeshBasicMaterial({ color: 0xff0000 });

      const newMesh = new Mesh(geometry, material);
      meshMap.set(gameObject, newMesh);
      threeScene.add(newMesh);
      return newMesh;
    };

    const meshQuery = query(
      (object) => hasComponent(object, TransformComponent) && hasComponent(object, MeshComponent),
    );

    onUpdate(() => {
      meshQuery(gameideScene).forEach((gameObject) => {
        const mesh = meshMap.get(gameObject) ?? createMeshForGameObject(gameObject);
        syncMeshComponent(gameObject, mesh);
      });
    });

    const resize = () => {
      const width = rootElement.clientWidth;
      const height = rootElement.clientHeight;

      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);

      renderer.render(threeScene, camera);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(rootElement);

    resize();

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
