import { Assets, Sprite } from "pixi.js";
import z from "zod";
import { defineComponent, hasComponent, type ComponentType } from "../components";
import type { GameContext } from "../initialization";
import { TransformComponent } from "../transform";
import type { ParentHierarchy } from "./handleParentHierarchy";

export const SpriteComponent = defineComponent(
  "sprite",
  z.object({
    sprite: z.string(),
    tint: z.string(),
    resolution: z.object({ width: z.number(), height: z.number() }),
  }),
  {
    sprite: "/default.png",
    tint: "#ffffff",
    resolution: { width: 100, height: 100 },
  },
);

export type SpriteObject = ComponentType<[typeof TransformComponent, typeof SpriteComponent]>;

export const handleSprites = async (gameContext: GameContext, hierarchy: ParentHierarchy) => {
  const { isEditor, queryScene, onUpdate, selectedObjectsStore } = gameContext;

  const spriteMap = new Map<SpriteObject, Sprite>();

  const createSpriteForGameObject = async (key: string, gameObject: SpriteObject) => {
    const texture = await Assets.load(gameObject.sprite);
    const newSprite = new Sprite(texture);
    newSprite.anchor.set(0.5);

    spriteMap.set(gameObject, newSprite);
    hierarchy.getContainer(key).addChild(newSprite);

    if (isEditor) {
      newSprite.eventMode = "static";
      newSprite.cursor = "pointer";

      newSprite.on("pointerdown", (event) => {
        event.stopPropagation();

        selectedObjectsStore.deselectObjects();
        selectedObjectsStore.selectObject(key, gameObject);
      });
    }
    return newSprite;
  };

  onUpdate(async () => {
    const foundObjects = new Set<SpriteObject>();

    const sprites = queryScene(
      (_, object) =>
        hasComponent(object, TransformComponent) && hasComponent(object, SpriteComponent),
    );
    for (const [key, gameObject] of sprites) {
      foundObjects.add(gameObject);

      const pixiSprite =
        spriteMap.get(gameObject) ?? (await createSpriteForGameObject(key, gameObject));

      const { sprite, tint, resolution } = gameObject;

      try {
        pixiSprite.texture = await Assets.load(sprite);
      } catch {}

      pixiSprite.scale.set(1, -1);
      pixiSprite.width = resolution.width;
      pixiSprite.height = resolution.height;
      pixiSprite.tint = tint;
    }

    for (const [gameObject, sprite] of spriteMap) {
      if (foundObjects.has(gameObject)) continue;

      sprite.parent?.removeChild(sprite);
      sprite.destroy();

      spriteMap.delete(gameObject);
    }
  });
};
