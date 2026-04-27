import * as THREE from "three";

export type ThreePluginCameraOptions = {
  fov?: number;
  near?: number;
  far?: number;
  z?: number;
};

export type ThreePluginCameraController = {
  camera: THREE.PerspectiveCamera;
  setPosition(x: number, y: number, z: number): void;
  move(x: number, y: number, z: number): void;
  lookAt(x: number, y: number, z: number): void;
};

/** Generic 3D view: one perspective camera plus imperative position / lookAt helpers. */
export type GameideSceneCamera = {
  /** Same object as `controller.camera` — the camera passed to `renderer.render`. */
  perspective: THREE.PerspectiveCamera;
  controller: ThreePluginCameraController;
};

type CreateThreePluginCameraOptions = {
  width: number;
  height: number;
  options?: ThreePluginCameraOptions;
};

export function createThreePluginCamera({
  width,
  height,
  options = {},
}: CreateThreePluginCameraOptions): ThreePluginCameraController {
  const camera = new THREE.PerspectiveCamera(
    options.fov ?? 70,
    width / height,
    options.near ?? 0.1,
    options.far ?? 1000,
  );
  camera.position.z = options.z ?? 5;

  return {
    camera,
    setPosition(x: number, y: number, z: number) {
      camera.position.set(x, y, z);
    },
    move(x: number, y: number, z: number) {
      camera.position.x += x;
      camera.position.y += y;
      camera.position.z += z;
    },
    lookAt(x: number, y: number, z: number) {
      camera.lookAt(x, y, z);
    },
  };
}

export function createGameideSceneCamera(
  args: CreateThreePluginCameraOptions
): GameideSceneCamera {
  const controller = createThreePluginCamera(args);
  return { perspective: controller.camera, controller };
}
