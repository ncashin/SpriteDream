import * as THREE from "three";
import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { defineTrait, implementsTrait } from "../trait/trait.js";
import { transformTrait } from "../trait/transform.js";
import { getScene } from "../scene/scene.js";
import { update } from "../lifecycle/gameloop.js";
import {
  createThreePluginCamera,
  type ThreePluginCameraOptions,
} from "./camera.js";

type ThreePluginOptions = {
  antialias?: boolean;
  alpha?: boolean;
  clearColor?: number;
  camera?: ThreePluginCameraOptions;
};

type ThreePluginContext = {
  rootElement: HTMLElement;
} & Record<string, unknown>;

export const meshRenderTrait = defineTrait(
  [
    transformTrait,
    {
      mesh: {
        kind: "box",
        width: 1,
        height: 1,
        depth: 1,
        color: "#7dd3fc",
      },
    },
  ],
  {
    name: "Mesh Render",
    description: "Render a Three.js mesh from scene object data.",
    icon: "box" satisfies IconSlug,
  }
);

type MeshRenderable = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  mesh: {
    kind: string;
    width: number;
    height: number;
    depth: number;
    color: string;
  };
};

export function threePlugin(options: ThreePluginOptions = {}) {
  return <Context extends ThreePluginContext>(context: Context) => {
    const rootElement = context.rootElement;
    const width = rootElement.clientWidth || 1;
    const height = rootElement.clientHeight || 1;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? true,
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    renderer.setClearColor(options.clearColor ?? 0x000000, options.alpha ? 0 : 1);
    rootElement.appendChild(renderer.domElement);

    const cameraController = createThreePluginCamera({
      width,
      height,
      options: options.camera,
    });
    const camera = cameraController.camera;

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const resize = () => {
      const nextWidth = rootElement.clientWidth || 1;
      const nextHeight = rootElement.clientHeight || 1;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    window.addEventListener("resize", resize);

    const draw = () => renderer.render(scene, camera);
    const renderablePredicate = implementsTrait(meshRenderTrait);
    const sceneState = getScene();
    const meshByObject = new Map<object, THREE.Mesh>();
    const materialByColor = new Map<string, THREE.MeshStandardMaterial>();

    const addMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material = new THREE.MeshNormalMaterial()
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      draw();
      return mesh;
    };

    const drawBox = (size = 1, material?: THREE.Material) =>
      addMesh(new THREE.BoxGeometry(size, size, size), material);

    const getMaterial = (color: string): THREE.MeshStandardMaterial => {
      const existing = materialByColor.get(color);
      if (existing) return existing;
      const next = new THREE.MeshStandardMaterial({ color });
      materialByColor.set(color, next);
      return next;
    };

    const syncRenderable = (item: MeshRenderable): void => {
      const key = item as unknown as object;
      const shouldRebuildGeometry = item.mesh.kind !== "box";
      const material = getMaterial(item.mesh.color ?? "#7dd3fc");
      let mesh = meshByObject.get(key);

      if (!mesh || shouldRebuildGeometry) {
        if (mesh) {
          scene.remove(mesh);
          mesh.geometry.dispose();
        }
        const geometry = new THREE.BoxGeometry(
          item.mesh.width,
          item.mesh.height,
          item.mesh.depth
        );
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        meshByObject.set(key, mesh);
      } else {
        mesh.material = material;
      }

      mesh.position.set(item.position.x, item.position.y, item.position.z);
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
      mesh.scale.set(item.scale.x, item.scale.y, item.scale.z);
    };

    let disposed = false;
    update(() => {
      if (disposed) return;
      const renderables = sceneState.query(renderablePredicate);
      const activeKeys = new Set<object>();
      for (const item of renderables) {
        const candidate = item as unknown as object;
        activeKeys.add(candidate);
        syncRenderable(item as MeshRenderable);
      }
      for (const [candidate, mesh] of meshByObject.entries()) {
        if (activeKeys.has(candidate)) continue;
        scene.remove(mesh);
        mesh.geometry.dispose();
        meshByObject.delete(candidate);
      }
      draw();
    });

    return {
      ...context,
      three: {
        THREE,
        scene,
        camera,
        cameraController,
        renderer,
        draw,
        addMesh,
        drawBox,
        dispose() {
          disposed = true;
          window.removeEventListener("resize", resize);
          for (const mesh of meshByObject.values()) {
            scene.remove(mesh);
            mesh.geometry.dispose();
          }
          meshByObject.clear();
          for (const material of materialByColor.values()) {
            material.dispose();
          }
          materialByColor.clear();
          renderer.dispose();
          if (renderer.domElement.parentElement === rootElement) {
            rootElement.removeChild(renderer.domElement);
          }
        },
      },
    };
  };
}
