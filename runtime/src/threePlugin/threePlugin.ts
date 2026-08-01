import {
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
} from "three";
import { hasComponent } from "../components";
import type { GameContext } from "../initialization";
import { query } from "../scene";
import { createDebugCamera } from "./editorCamera";
import { MeshComponent, syncMeshComponent } from "./mesh";
import { TransformComponent } from "./transform";

export const threePlugin = () => (context: GameContext) => {
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
    const foundObjects = new Set<object>();

    meshQuery(gameideScene).forEach((gameObject) => {
      foundObjects.add(gameObject);

      const mesh = meshMap.get(gameObject) ?? createMeshForGameObject(gameObject);

      syncMeshComponent(gameObject, mesh);
    });

    for (const [gameObject, mesh] of meshMap) {
      if (foundObjects.has(gameObject)) continue;

      threeScene.remove(mesh);

      mesh.geometry.dispose();

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }

      meshMap.delete(gameObject);
    }
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
};
