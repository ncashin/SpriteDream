import { PerspectiveCamera, Vector3 } from "three";

export function createDebugCamera(camera: PerspectiveCamera, domElement: HTMLElement) {
  const keys = new Set<string>();

  let yaw = camera.rotation.y;
  let pitch = camera.rotation.x;

  let rotating = false;
  let panning = false;

  let lastX = 0;
  let lastY = 0;

  const speed = 4;
  const panSpeed = 0.01;
  const sensitivity = 0.005;

  const right = new Vector3();
  const up = new Vector3();

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    keys.add(event.code);
  });

  window.addEventListener("keyup", (event: KeyboardEvent) => {
    keys.delete(event.code);
  });

  domElement.addEventListener("mousedown", (event: MouseEvent) => {
    if (event.button === 0) {
      rotating = true;
    }

    if (event.button === 1) {
      panning = true;
      event.preventDefault();
    }

    lastX = event.clientX;
    lastY = event.clientY;
  });

  window.addEventListener("mouseup", (_event: MouseEvent) => {
    rotating = false;
    panning = false;
  });

  window.addEventListener("mousemove", (event: MouseEvent) => {
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;

    lastX = event.clientX;
    lastY = event.clientY;

    if (rotating) {
      yaw -= dx * sensitivity;
      pitch -= dy * sensitivity;

      pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    }

    if (panning) {
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);

      up.set(0, 1, 0).applyQuaternion(camera.quaternion);

      camera.position.addScaledVector(right, -dx * panSpeed);

      camera.position.addScaledVector(up, dy * panSpeed);
    }
  });

  domElement.addEventListener("auxclick", (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  });

  function update(delta: number) {
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    const amount = speed * delta;

    if (keys.has("KeyW")) camera.translateZ(-amount);
    if (keys.has("KeyS")) camera.translateZ(amount);

    if (keys.has("KeyA")) camera.translateX(-amount);
    if (keys.has("KeyD")) camera.translateX(amount);

    if (keys.has("Space")) camera.translateY(amount); // up
    if (keys.has("ShiftLeft")) camera.translateY(-amount); // down
  }

  function dispose() {
    keys.clear();
    rotating = false;
    panning = false;
  }

  return {
    update,
    dispose,
  };
}
