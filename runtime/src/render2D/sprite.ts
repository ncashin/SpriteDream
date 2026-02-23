import { Application, Assets, Sprite } from "pixi.js";

import { defineObject, type Instance } from "../scene/objectDefinition";
import type { SceneWithAPI } from "../scene/scene";
import { transform2DDefinition } from "./transform2D";

export const spriteDefinition = defineObject([
  transform2DDefinition,
  {
    sprite: {
      image: "",
      width: 0,
      height: 0,
    },
  },
]);

export type SpriteInstance = Instance<typeof spriteDefinition>;

const spriteRecord: Record<string, Sprite> = {};

async function synchronizeSprite(
  application: Application,
  path: string,
  object: SpriteInstance,
): Promise<void> {
  const existingSprite = spriteRecord[path];
  if (existingSprite) {
    existingSprite.position.set(object.transform2D.x, object.transform2D.y);
    existingSprite.rotation = object.transform2D.rotation;
    existingSprite.width = object.sprite.width;
    existingSprite.height = object.sprite.height;
    const texture = await Assets.load(object.sprite.image);
    existingSprite.texture = texture;
    return;
  }
  const texture = await Assets.load(object.sprite.image);
  const pixiSprite = new Sprite(texture);
  pixiSprite.position.set(object.transform2D.x, object.transform2D.y);
  pixiSprite.rotation = object.transform2D.rotation;
  pixiSprite.width = object.sprite.width;
  pixiSprite.height = object.sprite.height;
  application.stage.addChild(pixiSprite);
  spriteRecord[path] = pixiSprite;
}

export function handleSprites(
  pixiAppReady: Promise<Application>,
  scene: SceneWithAPI,
): void {
  scene.onQueryChange(spriteDefinition, async (change) => {
    const application = await pixiAppReady;
    const path = change.path;

    if (change.type === "destroyed") {
      const pixiSprite = spriteRecord[path];
      if (pixiSprite) {
        application.stage.removeChild(pixiSprite);
        pixiSprite.destroy();
        delete spriteRecord[path];
      }
      return;
    }

    if (change.type === "created") {
      const sprites = scene.query(spriteDefinition);
      const object = sprites[path];
      if (object) await synchronizeSprite(application, path, object);
      return;
    }

    if (change.type === "propertyUpdated") {
      const rootPath = path.split(".")[0];
      const pixiSprite = spriteRecord[rootPath];
      if (!pixiSprite) return;
      switch (change.segmentKey) {
        case "transform2D":
          pixiSprite.position.set(change.newValue.x, change.newValue.y);
          pixiSprite.rotation = change.newValue.rotation;
          break;
        case "transform2D.x":
          pixiSprite.position.x = change.newValue;
          break;
        case "transform2D.y":
          pixiSprite.position.y = change.newValue;
          break;
        case "transform2D.rotation":
          pixiSprite.rotation = change.newValue;
          break;
        case "sprite":
          pixiSprite.width = change.newValue.width;
          pixiSprite.height = change.newValue.height;
          pixiSprite.texture = await Assets.load(change.newValue.image);
          break;
        case "sprite.width":
          pixiSprite.width = change.newValue;
          break;
        case "sprite.height":
          pixiSprite.height = change.newValue;
          break;
        case "sprite.image":
          pixiSprite.texture = await Assets.load(change.newValue);
          break;
      }
    }
  });
}
