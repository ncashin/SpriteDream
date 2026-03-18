import { Application, Assets, Sprite, Texture } from "pixi.js";
import { update } from "../gameloop.js";
import { createObjectGuard } from "../objectRegistry.js";
import { defineObject } from "../objectRegistry.js";
import { getScene } from "../scene.js";
import { TransformDefinition2D } from "./transform.js";

export const SpriteDefinition = defineObject([
  TransformDefinition2D,
  {
    sprite: {
      image: "",
      tint: "rgba(255,255,255,1)",
    },
  },
]);

export function initializeSpriteRendering(app: Application): void {
  const isSpriteRenderable = createObjectGuard(SpriteDefinition);
  const scene = getScene();
  const spriteRegistry = new Map<object, Sprite>();
  const requestedAssetKeyByObject = new Map<object, string>();

  update(() => {
    const activeSprites = new Set<object>();
    const renderables = scene.query(isSpriteRenderable);

    for (const renderable of renderables) {
      activeSprites.add(renderable);

      let sprite = spriteRegistry.get(renderable);
      if (!sprite) {
        sprite = new Sprite(Texture.WHITE);
        sprite.anchor.set(0.5, 0.5);
        spriteRegistry.set(renderable, sprite);
        app.stage.addChild(sprite);
      }

      const image =
        typeof renderable.sprite?.image === "string" && renderable.sprite.image.length > 0
          ? renderable.sprite.image
          : "";
      sprite.tint =
        typeof renderable.sprite?.tint === "string" && renderable.sprite.tint.length > 0
          ? renderable.sprite.tint
          : "rgba(255,255,255,1)";
      if (!image) {
        sprite.texture = Texture.EMPTY;
        requestedAssetKeyByObject.delete(renderable);
      } else {
        const cacheKey = image;

        const lastRequestedKey = requestedAssetKeyByObject.get(renderable);
        if (lastRequestedKey !== cacheKey) {
          requestedAssetKeyByObject.set(renderable, cacheKey);
          sprite.texture = Texture.EMPTY;

          void (async () => {
            const texture = await Assets.load<Texture>(image);
            if (spriteRegistry.get(renderable) === sprite && requestedAssetKeyByObject.get(renderable) === cacheKey) {
              sprite.texture = texture;
            }
          })();
        }
      }

      const scaleX = renderable.transform2D.scaleX ?? 1;
      const scaleY = renderable.transform2D.scaleY ?? 1;

      sprite.position.set(renderable.transform2D.x, renderable.transform2D.y);
      sprite.rotation = renderable.transform2D.rotation ?? 0;

      sprite.scale.set(scaleX, -scaleY);
    }

    for (const [object, sprite] of spriteRegistry) {
      if (activeSprites.has(object)) continue;
      sprite.destroy();
      spriteRegistry.delete(object);
      requestedAssetKeyByObject.delete(object);
    }
  });
}
