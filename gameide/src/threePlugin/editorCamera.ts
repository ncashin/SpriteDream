import type { PerspectiveCamera } from "three";

type CreateEditorCameraControllerOptions = {
  input: {
    axes: { EditorHorizontal: number; EditorVertical: number };
    buttons: {
      LookCamera: { held: boolean };
      EditorMoveUp: { held: boolean };
      EditorMoveDown: { held: boolean };
    };
    mouse: { delta: { x: number; y: number } };
  };
  three: { camera: PerspectiveCamera };
  moveSpeed?: number;
  lookSensitivity?: number;
};

export type EditorCameraController = {
  update(deltaTime: number): void;
};

export function createEditorCameraController({
  input,
  three,
  moveSpeed = 4,
  lookSensitivity = 0.0025,
}: CreateEditorCameraControllerOptions): EditorCameraController {
  const maxPitch = Math.PI / 2 - 0.01;
  const camera = three.camera;
  camera.rotation.order = "YXZ";

  let yaw = camera.rotation.y;
  let pitch = camera.rotation.x;

  return {
    update(deltaTime: number) {
      const horizontal = input.axes.EditorHorizontal;
      const vertical = input.axes.EditorVertical;
      const lookCamera = input.buttons.LookCamera.held;
      const verticalLook =
        (input.buttons.EditorMoveUp.held ? 1 : 0) -
        (input.buttons.EditorMoveDown.held ? 1 : 0);

      if (lookCamera) {
        yaw -= input.mouse.delta.x * lookSensitivity;
        pitch -= input.mouse.delta.y * lookSensitivity;
        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
      }

      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
      camera.translateX(horizontal * moveSpeed * deltaTime);
      camera.translateZ(-vertical * moveSpeed * deltaTime);
      camera.position.y += verticalLook * moveSpeed * deltaTime;
    },
  };
}
