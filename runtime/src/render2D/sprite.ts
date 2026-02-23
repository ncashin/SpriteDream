import {
  type Application,
  type Container,
  Assets,
  Graphics,
  GraphicsContext,
  Sprite,
} from "pixi.js";

function isGraphicsContext(value: unknown): value is GraphicsContext {
  return value instanceof GraphicsContext;
}

import { defineObject, type Instance } from "../scene/objectDefinition";
import type { SceneWithAPI } from "../scene/scene";
import { Transform2DDefinition } from "./transform2D";

export const SpriteDefinition = defineObject([
  Transform2DDefinition,
  {
    sprite: {
      __icon: "Image",
      image: "",
      width: 0,
      height: 0,
    },
  },
]);

export type SpriteInstance = Instance<typeof SpriteDefinition>;

function isSVGPath(imageURL: string): boolean {
  return /\.svg$/i.test(imageURL);
}

type SpriteDisplayObject = Sprite | Graphics;

const spriteRecord: Record<string, SpriteDisplayObject> = {};

function applyTransformAndSize(
  displayObject: SpriteDisplayObject,
  spriteInstance: SpriteInstance,
): void {
  displayObject.position.set(spriteInstance.transform2D.x, spriteInstance.transform2D.y);
  displayObject.rotation = spriteInstance.transform2D.rotation;
  const scaleX = spriteInstance.transform2D.scaleX;
  const scaleY = spriteInstance.transform2D.scaleY;

  const width = spriteInstance.sprite.width;
  const height = spriteInstance.sprite.height;

  if (displayObject instanceof Sprite) {
    displayObject.anchor.set(0.5, 0.5);
    displayObject.width = width;
    displayObject.height = height;
    displayObject.scale.set(scaleX, scaleY);
    return;
  }

  const bounds = displayObject.bounds;
  const boundsWidth = bounds.width || 1;
  const boundsHeight = bounds.height || 1;

  displayObject.pivot.set(boundsWidth / 2, boundsHeight / 2);
  displayObject.scale.set(
    (width ? width / boundsWidth : 1) * scaleX,
    (height ? height / boundsHeight : 1) * scaleY
  );
}

async function synchronizeSprite(
  world: Container,
  path: string,
  spriteInstance: SpriteInstance,
): Promise<void> {
  const imageURL = spriteInstance.sprite.image;
  const useSVGGraphics = isSVGPath(imageURL);
  const existingDisplayObject = spriteRecord[path];

  if (existingDisplayObject) {
    const existingIsGraphics = existingDisplayObject instanceof Graphics;
    if (existingIsGraphics === useSVGGraphics) {
      applyTransformAndSize(existingDisplayObject, spriteInstance);
      if (existingDisplayObject instanceof Sprite) {
        existingDisplayObject.texture = await Assets.load(imageURL);
        return;
      }
      const loaded = await Assets.load({
        src: imageURL,
        data: { parseAsGraphicsContext: true },
      });
      if (!isGraphicsContext(loaded)) return;
      existingDisplayObject.context = loaded;
      applyTransformAndSize(existingDisplayObject, spriteInstance);
      return;
    }
    world.removeChild(existingDisplayObject);
    existingDisplayObject.destroy();
    delete spriteRecord[path];
  }

  if (useSVGGraphics) {
    const loaded = await Assets.load({
      src: imageURL,
      data: { parseAsGraphicsContext: true },
    });
    if (!isGraphicsContext(loaded)) return;

    const newGraphics = new Graphics(loaded);
    applyTransformAndSize(newGraphics, spriteInstance);
    world.addChild(newGraphics);
    spriteRecord[path] = newGraphics;
    return;
  }

  const texture = await Assets.load(imageURL);
  const newSprite = new Sprite(texture);
  applyTransformAndSize(newSprite, spriteInstance);
  world.addChild(newSprite);
  spriteRecord[path] = newSprite;
}

export function handleSprites(
  pixiAppAndWorld: Promise<{ application: Application; world: Container }>,
  scene: SceneWithAPI,
): void {
  scene.onQueryChange(SpriteDefinition, async (change) => {
    const { world } = await pixiAppAndWorld;
    const path = change.path;

    if (change.type === "destroyed") {
      const displayObject = spriteRecord[path];
      if (!displayObject) return;
      world.removeChild(displayObject);
      displayObject.destroy();
      delete spriteRecord[path];
      return;
    }

    if (change.type === "created") {
      const spritesDictionary = scene.query(SpriteDefinition);
      const spriteInstance = spritesDictionary[path];
      if (!spriteInstance) return;
      await synchronizeSprite(world, path, spriteInstance);
      return;
    }

    if (change.type !== "propertyUpdated") return;

    const rootPath = path.split(".")[0];
    const displayObject = spriteRecord[rootPath];
    if (!displayObject) return;
    const spriteInstance = scene.query(SpriteDefinition)[rootPath];
    if (!spriteInstance) return;

    switch (change.segmentKey) {
      case "transform2D":
        displayObject.position.set(change.newValue.x, change.newValue.y);
        displayObject.rotation = change.newValue.rotation;
        displayObject.scale.set(change.newValue.scaleX, change.newValue.scaleY);
        break;
      case "transform2D.x":
        displayObject.position.x = change.newValue;
        break;
      case "transform2D.y":
        displayObject.position.y = change.newValue;
        break;
      case "transform2D.rotation":
        displayObject.rotation = change.newValue;
        break;
      case "transform2D.scaleX":
      case "transform2D.scaleY":
        applyTransformAndSize(displayObject, spriteInstance);
        break;
      case "sprite": {
        const updatedSprite = change.newValue;
        
        if (displayObject instanceof Sprite) {
          displayObject.width = updatedSprite.width;
          displayObject.height = updatedSprite.height;
          displayObject.texture = await Assets.load(updatedSprite.image);
          break;
        }

        const loaded = await Assets.load({
          src: updatedSprite.image,
          data: { parseAsGraphicsContext: true },
        });
        if (!isGraphicsContext(loaded)) break;
        displayObject.context = loaded;
        const bounds = displayObject.bounds;
        displayObject.scale.set(
          updatedSprite.width ? updatedSprite.width / (bounds.width || 1) : 1,
          updatedSprite.height ? updatedSprite.height / (bounds.height || 1) : 1
        );
        break;
      }
      case "sprite.width":
        if (displayObject instanceof Sprite) {
          displayObject.width = change.newValue;
          break;
        }
        {
          const bounds = displayObject.bounds;
          displayObject.scale.x = change.newValue
            ? change.newValue / (bounds.width || 1)
            : 1;
        }
        break;
      case "sprite.height":
        if (displayObject instanceof Sprite) {
          displayObject.height = change.newValue;
          break;
        }
        {
          const bounds = displayObject.bounds;
          displayObject.scale.y = change.newValue
            ? change.newValue / (bounds.height || 1)
            : 1;
        }
        break;
      case "sprite.image": {
        const newImageURL = change.newValue as string;
        if (isSVGPath(newImageURL) && displayObject instanceof Graphics) {
          const loaded = await Assets.load({
            src: newImageURL,
            data: { parseAsGraphicsContext: true },
          });
          if (!isGraphicsContext(loaded)) break;
          displayObject.context = loaded;
          break;
        }

        if (isSVGPath(newImageURL)) {
          await synchronizeSprite(world, rootPath, {
            ...spriteInstance,
            sprite: { ...spriteInstance.sprite, image: newImageURL },
          });
          break;
        }

        if (displayObject instanceof Sprite) {
          displayObject.texture = await Assets.load(newImageURL);
          break;
        }

        await synchronizeSprite(world, rootPath, {
          ...spriteInstance,
          sprite: { ...spriteInstance.sprite, image: newImageURL },
        });
        break;
      }
    }
  });
}
