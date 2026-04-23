import {
  implementsTrait,
  defineTrait,
  getScene,
  OWNER_ID,
  gameStart,
  gameUpdate,
  $string,
  transformTrait,
  meshRenderTrait,
} from "gameide";
import type { MainContext } from "./gameConfig";

const playerTrait = defineTrait([
  meshRenderTrait,
  {
    [OWNER_ID]: $string,
    speed: 200,
  },
]);

function playerColor(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360} 55% 52%)`;
}

export function main({ input, networking, three }: MainContext): void {
  const scene = getScene();
  const cameraMoveSpeed = 4;
  const cameraLookSensitivity = 0.0025;
  const maxPitch = Math.PI / 2 - 0.01;
  const camera = three.camera;
  camera.rotation.order = "YXZ";
  let cameraYaw = camera.rotation.y;
  let cameraPitch = camera.rotation.x;

  gameStart(() => {
    scene.createObject(
      networking.peerId,
      networking.withOwnership({
        ...transformTrait,
        ...meshRenderTrait,
        mesh: {
          ...meshRenderTrait.mesh,
          width: 0.8,
          height: 0.8,
          depth: 0.8,
          color: playerColor(networking.peerId),
        },
        speed: 200,
      }),
    );
  });

  gameUpdate((deltaTime: number) => {
    const horizontal = input.axes.Horizontal;
    const vertical = input.axes.Vertical;
    const lookCamera = input.buttons.LookCamera.held;
    const verticalLook =
      (input.buttons.MoveUp.held ? 1 : 0) - (input.buttons.MoveDown.held ? 1 : 0);
    if (lookCamera) {
      cameraYaw -= input.mouse.delta.x * cameraLookSensitivity;
      cameraPitch -= input.mouse.delta.y * cameraLookSensitivity;
      cameraPitch = Math.max(-maxPitch, Math.min(maxPitch, cameraPitch));
    }
    camera.rotation.y = cameraYaw;
    camera.rotation.x = cameraPitch;
    camera.translateX(horizontal * cameraMoveSpeed * deltaTime);
    camera.translateZ(-vertical * cameraMoveSpeed * deltaTime);
    camera.position.y += verticalLook * cameraMoveSpeed * deltaTime;

    for (const player of scene.query(implementsTrait(playerTrait))) {
      if (true || !networking.isOwned(player)) continue;

      player.position.x += horizontal * player.speed * deltaTime;
      player.position.y += vertical * player.speed * deltaTime;
      player.rotation.z += horizontal * deltaTime * 2;
    }
  });
}
