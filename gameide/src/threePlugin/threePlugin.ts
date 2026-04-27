import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { IconSlug } from "../lucide/lucideIconSlug.js";
import { defineTrait, implementsTrait } from "../trait/trait.js";
import { transformTrait } from "../trait/transform.js";
import { getScene } from "../scene/scene.js";
import { update } from "../lifecycle/gameloop.js";
import type { Plugin } from "../lifecycle/plugin.js";
import {
  createThreePluginCamera,
  type ThreePluginCameraOptions,
  type ThreePluginCameraController,
} from "./camera.js";

type ThreePluginOptions = {
  antialias?: boolean;
  alpha?: boolean;
  clearColor?: number;
  camera?: ThreePluginCameraOptions;
  /**
   * Map from project-relative asset keys (e.g. `"assets/model.glb"`) to resolved URLs.
   * Typically `import { loadAssets } from "virtual:gameide-assets";` then `loadAssets()`.
   */
  assets?: Readonly<Record<string, string>>;
};

export type ThreePluginRequiredContext = { rootElement: HTMLElement };

export type ThreePluginApi = {
  THREE: typeof THREE;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cameraController: ThreePluginCameraController;
  renderer: THREE.WebGLRenderer;
  draw: () => void;
  addMesh: (
    geometry: THREE.BufferGeometry,
    material?: THREE.Material
  ) => THREE.Mesh;
  drawBox: (size?: number, material?: THREE.Material) => THREE.Mesh;
  dispose: () => void;
};

/** Renders 3D content in the three.js view (box primitive and/or `assets` from loadAssets). */
export const normalRenderTrait = defineTrait(
  [
    transformTrait,
    {
      model: {
        width: 1,
        height: 1,
        depth: 1,
        color: "#7dd3fc",
        /** `loadAssets()` key, e.g. `"assets/character.glb"` or a texture under `assets/`. */
        asset: "",
      },
    },
  ],
  {
    name: "Normal render",
    description:
      "Renders a 3D object (box) or a model/texture from the project assets folder.",
    icon: "box" satisfies IconSlug,
  }
);

type ModelSpec = {
  /** Primitive type; omitted defaults to `"box"`. Not required when `asset` is a GLB/texture. */
  kind?: string;
  width: number;
  height: number;
  depth: number;
  color: string;
  asset: string;
};

type NormalRenderable = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  model: ModelSpec;
};

function isGltfKey(assetKey: string): boolean {
  return /\.(gltf|glb)$/i.test(assetKey);
}

function isImageKey(assetKey: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|ktx2)$/i.test(assetKey);
}

function disposeObjectTree(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const m = child.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

function pickAssetUrl(
  assets: Readonly<Record<string, string>> | undefined,
  key: string
): string | undefined {
  if (!key || !assets) return undefined;
  return assets[key];
}

export function threePlugin(
  options: ThreePluginOptions = {}
): Plugin<ThreePluginRequiredContext, { three: ThreePluginApi }> {
  return (context) => {
    const rootElement = context.rootElement;
    const width = rootElement.clientWidth || 1;
    const height = rootElement.clientHeight || 1;
    const assets = options.assets;

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
    const renderablePredicate = implementsTrait(normalRenderTrait);
    const sceneState = getScene();

    type Visual = {
      root: THREE.Object3D;
      mode: "box" | "gltf" | "textured";
      signature: string;
    };
    const visualByEntity = new Map<object, Visual>();
    const gltfTemplateByKey = new Map<string, THREE.Object3D>();
    const gltfLoader = new GLTFLoader();
    const textureByKey = new Map<string, THREE.Texture>();
    const materialByColor = new Map<string, THREE.MeshStandardMaterial>();
    const textureMaterialByKey = new Map<string, THREE.MeshStandardMaterial>();

    const getMaterial = (color: string): THREE.MeshStandardMaterial => {
      const existing = materialByColor.get(color);
      if (existing) return existing;
      const next = new THREE.MeshStandardMaterial({ color });
      materialByColor.set(color, next);
      return next;
    };

    const getTextureMaterial = (assetKey: string, url: string): void => {
      if (textureMaterialByKey.has(assetKey)) return;
      const loader = new THREE.TextureLoader();
      void (async () => {
        const texture = await loader.loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        textureByKey.set(assetKey, texture);
        const mat = new THREE.MeshStandardMaterial({ map: texture });
        textureMaterialByKey.set(assetKey, mat);
      })();
    };

    const getGltfTemplate = (assetKey: string, url: string): void => {
      if (gltfTemplateByKey.has(assetKey)) return;
      void (async () => {
        const gltf = await gltfLoader.loadAsync(url);
        gltfTemplateByKey.set(assetKey, gltf.scene);
      })();
    };

    const setObjectFromItem = (
      o: THREE.Object3D,
      item: {
        position: NormalRenderable["position"];
        rotation: NormalRenderable["rotation"];
        scale: NormalRenderable["scale"];
      }
    ) => {
      o.position.set(item.position.x, item.position.y, item.position.z);
      o.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
      o.scale.set(item.scale.x, item.scale.y, item.scale.z);
    };

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

    const modelKind = (m: ModelSpec): string => m.kind ?? "box";

    const buildSignature = (m: ModelSpec, assetUrl: string | undefined): string => {
      const k = m.asset?.trim() ?? "";
      return `${k}|${assetUrl ?? ""}|${modelKind(m)}|${m.width}|${m.height}|${m.depth}|${m.color}`;
    };

    const syncBox = (item: NormalRenderable, key: object): void => {
      const m = item.model;
      const material = getMaterial(m.color ?? "#7dd3fc");
      const url = pickAssetUrl(assets, m.asset?.trim() ?? "");
      const sig = buildSignature(m, url);
      let visual = visualByEntity.get(key);
      if (!visual || visual.mode !== "box") {
        if (visual) {
          scene.remove(visual.root);
          disposeObjectTree(visual.root);
        }
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(m.width, m.height, m.depth),
          material
        );
        scene.add(mesh);
        visualByEntity.set(key, { root: mesh, mode: "box", signature: sig });
        setObjectFromItem(mesh, item);
        return;
      }
      const mesh = visual.root as THREE.Mesh;
      if (modelKind(m) !== "box" || visual.signature !== sig) {
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(m.width, m.height, m.depth);
        mesh.material = material;
        visual.signature = sig;
      } else {
        mesh.material = material;
      }
      setObjectFromItem(mesh, item);
    };

    const tryAttachTexturedOrGltf = (item: NormalRenderable, key: object): void => {
      const m = item.model;
      const assetKey = m.asset?.trim() ?? "";
      if (!assetKey) {
        syncBox(item, key);
        return;
      }
      const url = pickAssetUrl(assets, assetKey);
      if (!url) {
        syncBox(item, key);
        return;
      }

      if (isGltfKey(assetKey)) {
        getGltfTemplate(assetKey, url);
        const template = gltfTemplateByKey.get(assetKey);
        if (!template) {
          if (!visualByEntity.has(key) || visualByEntity.get(key)?.mode !== "box")
            syncBox(item, key);
          return;
        }

        const sig = buildSignature(m, url);
        let visual = visualByEntity.get(key);
        if (visual && visual.mode === "gltf" && visual.signature === sig) {
          setObjectFromItem(visual.root, item);
          return;
        }
        if (visual) {
          scene.remove(visual.root);
          disposeObjectTree(visual.root);
        }
        const root = template.clone(true);
        const next: Visual = { root, mode: "gltf", signature: sig };
        scene.add(root);
        visualByEntity.set(key, next);
        setObjectFromItem(root, item);
        return;
      }

      if (isImageKey(assetKey)) {
        getTextureMaterial(assetKey, url);
        const mat = textureMaterialByKey.get(assetKey);
        if (!mat) {
          if (!visualByEntity.has(key) || visualByEntity.get(key)?.mode !== "box")
            syncBox(item, key);
          return;
        }
        const sig = buildSignature(m, url);
        let visual = visualByEntity.get(key);
        if (visual && visual.mode === "textured" && visual.signature === sig) {
          setObjectFromItem(visual.root, item);
          return;
        }
        if (visual) {
          scene.remove(visual.root);
          disposeObjectTree(visual.root);
        }
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(m.width, m.height, m.depth),
          mat
        );
        const next: Visual = { root: mesh, mode: "textured", signature: sig };
        scene.add(mesh);
        visualByEntity.set(key, next);
        setObjectFromItem(mesh, item);
        return;
      }

      syncBox(item, key);
    };

    const syncRenderable = (item: NormalRenderable, key: object): void => {
      const assetKey = item.model.asset?.trim() ?? "";
      const url = pickAssetUrl(assets, assetKey);
      if (assetKey && url && (isGltfKey(assetKey) || isImageKey(assetKey))) {
        tryAttachTexturedOrGltf(item, key);
        return;
      }
      syncBox(item, key);
    };

    let disposed = false;
    update(() => {
      if (disposed) return;
      const renderables = sceneState.query(renderablePredicate);
      const activeKeys = new Set<object>();
      for (const item of renderables) {
        const candidate = item as unknown as object;
        activeKeys.add(candidate);
        syncRenderable(item as NormalRenderable, candidate);
      }
      for (const [candidate, visual] of visualByEntity.entries()) {
        if (activeKeys.has(candidate)) continue;
        scene.remove(visual.root);
        disposeObjectTree(visual.root);
        visualByEntity.delete(candidate);
      }
      draw();
    });

    const three: ThreePluginApi = {
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
        for (const visual of visualByEntity.values()) {
          scene.remove(visual.root);
          disposeObjectTree(visual.root);
        }
        visualByEntity.clear();
        for (const material of materialByColor.values()) {
          material.dispose();
        }
        materialByColor.clear();
        for (const material of textureMaterialByKey.values()) {
          material.dispose();
        }
        textureMaterialByKey.clear();
        for (const texture of textureByKey.values()) {
          texture.dispose();
        }
        textureByKey.clear();
        gltfTemplateByKey.clear();
        renderer.dispose();
        if (renderer.domElement.parentElement === rootElement) {
          rootElement.removeChild(renderer.domElement);
        }
      },
    };

    return { ...context, three };
  };
}