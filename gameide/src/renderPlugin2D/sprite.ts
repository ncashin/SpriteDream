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
  const textureRegistry = new Map<string, Texture>();
  const loadingTextures = new Map<string, Promise<Texture>>();

  function getTexture(image: string): Promise<Texture> {
    const cachedTexture = textureRegistry.get(image);
    if (cachedTexture) return Promise.resolve(cachedTexture);

    const cachedLoad = loadingTextures.get(image);
    if (cachedLoad) return cachedLoad;

    const load = Assets.load<Texture>(image)
      .then((texture) => {
        textureRegistry.set(image, texture);
        loadingTextures.delete(image);
        return texture;
      })
      .catch(() => {
        textureRegistry.set(image, Texture.EMPTY);
        loadingTextures.delete(image);
        return Texture.EMPTY;
      });
    loadingTextures.set(image, load);
    return load;
  }

  update(() => {
    const activeSprites = new Set<object>();
    const renderables = scene.query(isSpriteRenderable);

    for (const renderable of renderables) {
      activeSprites.add(renderable);

      let sprite = spriteRegistry.get(renderable);
      if (!sprite) {
        sprite = new Sprite(Texture.WHITE);
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
      } else {
        const cachedTexture = textureRegistry.get(image);
        if (cachedTexture) {
          sprite.texture = cachedTexture;
        } else {
          sprite.texture = Texture.EMPTY;
          void getTexture(image).then((texture) => {
            if (spriteRegistry.get(renderable) === sprite) {
              sprite.texture = texture;
            }
          });
        }
      }

      sprite.position.set(renderable.transform2D.x, renderable.transform2D.y);
      sprite.rotation = renderable.transform2D.rotation ?? 0;
      sprite.width = sprite.texture.width * (renderable.transform2D.scaleX ?? 1);
      sprite.height = sprite.texture.height * (renderable.transform2D.scaleY ?? 1);
    }

    for (const [object, sprite] of spriteRegistry) {
      if (activeSprites.has(object)) continue;
      sprite.destroy();
      spriteRegistry.delete(object);
    }
  });
}
