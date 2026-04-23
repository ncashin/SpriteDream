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
import { createEditorCameraController } from "./editorCamera";

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
  const editorCamera = createEditorCameraController({ input, three });

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
    editorCamera.update(deltaTime);

    for (const player of scene.query(implementsTrait(playerTrait))) {
      if (!networking.isOwned(player)) continue;

      player.position.x += horizontal * player.speed * deltaTime;
      player.position.y += vertical * player.speed * deltaTime;
      player.rotation.z += horizontal * deltaTime * 2;
    }
  });
}
