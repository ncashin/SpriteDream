import { Application, Assets, Sprite } from "pixi.js";
import invariant from "tiny-invariant";

import type { Plugin } from "../runtime/plugin";
import { getScene } from "../scene/scene";
import { spriteDefinition, type SpriteInstance } from "./sprite";

export const render2DPlugin = (): Plugin => (context) => {
  const gameElement = document.getElementById("game");
  invariant(gameElement, "#game element must exist in the DOM");

  const app = new Application();
  const pixiAppReady = app
    .init({
      resizeTo: gameElement,
      backgroundColor: 0x1099bb,
    })
    .then(() => {
      gameElement.appendChild(app.canvas);
      return app;
    });

  const spriteMap = new Map<string, Sprite>();

  const syncSprite = async (
    app: Application,
    path: string,
    obj: SpriteInstance,
  ) => {
    const existing = spriteMap.get(path);
    if (existing) {
      existing.position.set(obj.transform2D.x, obj.transform2D.y);
      existing.rotation = obj.transform2D.rotation;
      existing.width = obj.sprite.width;
      existing.height = obj.sprite.height;
      const texture = await Assets.load(obj.sprite.image);
      existing.texture = texture;
      return;
    }
    const texture = await Assets.load(obj.sprite.image);
    const pixiSprite = new Sprite(texture);
    pixiSprite.position.set(obj.transform2D.x, obj.transform2D.y);
    pixiSprite.rotation = obj.transform2D.rotation;
    pixiSprite.width = obj.sprite.width;
    pixiSprite.height = obj.sprite.height;
    app.stage.addChild(pixiSprite);
    spriteMap.set(path, pixiSprite);
  };

  const scene = getScene();
  scene.onQueryChange(spriteDefinition, async (change) => {
    const app = await pixiAppReady;
    const path = change.path;
    
    if (change.type === "destroyed") {
      const pixiSprite = spriteMap.get(path);
      if (pixiSprite) {
        app.stage.removeChild(pixiSprite);
        pixiSprite.destroy();
        spriteMap.delete(path);
      }
      return;
    }

    if (change.type === "created") {
      const sprites = scene.query(spriteDefinition);
      const obj = sprites[path];
      if (obj) syncSprite(app, path, obj);
      return;
    }

    if (change.type === "propertyUpdated") {
      const rootPath = path.split(".")[0];
      const pixiSprite = spriteMap.get(rootPath);
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

  return {
    ...context,
    pixiApp: app,
    pixiAppReady,
  };
};
