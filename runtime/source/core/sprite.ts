import type { ContextExtension, RequirePlugin } from "./gameContext";
import type { Component, ClickableEntityProvider } from "./ecs/ecs";
import { TransformComponentDefinition, defineComponent } from "./ecs/component";
import { ecsPlugin } from "./scene/ecsAdapter";
import { addDrawCallback, isUpdateEnabled } from "./gameloop";
import { getViewport } from "./viewport/viewportPlugin";
import { getWorldTransform, getWorldPosition } from "./transform";
import { isEditorMode } from "./utils";
import * as PIXI from "pixi.js";
import { Application, Assets, Container, Graphics, Sprite, Texture } from "pixi.js";

export type HitFlashComponent = Component & {
  type: "hitFlash";
  flashTime: number;
  maxFlashTime: number;
};

export type SpriteComponent = Component & {
  type: "sprite";
  width: number;
  height: number;
  color: string;
  image?: string;
};
export const SpriteComponentDefinition: SpriteComponent = defineComponent(
  {
    type: "sprite",
    width: 32,
    height: 32,
    color: "#ffffff",
  },
  {
    displayName: "Sprite",
    description: "Visual representation of an entity",
    propertyInputTypes: {
      image: {
        type: "file",
        accept: ".png,.svg,.jpg,.jpeg",
        directory: "assets",
      },
      color: {
        type: "color",
      },
    },
  }
);

type SpriteRecord = {
  container: Container;
  base: Sprite;
  flashOverlay: Sprite;
  kind: "image" | "color";
  imageSrc?: string;
  width: number;
  height: number;
  color: string;
};

function normalizeAssetPath(src: string): string {
  if (!src) return src;

  if (/^(data:|blob:|https?:|file:)/i.test(src) || src.startsWith("//")) {
    return src;
  }

  const trimmed = src.startsWith("/") && !src.startsWith("//") ? src.slice(1) : src;

  if (typeof document !== "undefined" && document.baseURI) {
    try {
      return new URL(trimmed, document.baseURI).toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

const textureCache = new Map<string, Texture>();
const textureLoadPromises = new Map<string, Promise<Texture>>();

function loadTexture(path: string): Promise<Texture> {
  const normalizedPath = normalizeAssetPath(path);
  const cached = textureCache.get(normalizedPath);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existingPromise = textureLoadPromises.get(normalizedPath);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = Assets.load(normalizedPath)
    .then((texture) => {
      textureCache.set(normalizedPath, texture);
      textureLoadPromises.delete(normalizedPath);
      return texture;
    })
    .catch((error) => {
      textureLoadPromises.delete(normalizedPath);
      throw error;
    });

  textureLoadPromises.set(normalizedPath, promise);
  return promise;
}

function setSpriteTexture(sprite: Sprite, path: string): void {
  const normalizedPath = normalizeAssetPath(path);
  const cached = textureCache.get(normalizedPath);
  if (cached) {
    sprite.texture = cached;
    return;
  }

  sprite.texture = Texture.EMPTY;
  void loadTexture(normalizedPath)
    .then((texture) => {
      sprite.texture = texture;
    })
    .catch((error) => {
      console.warn(`Failed to load texture: ${path}`, error);
    });
}

function getDisplaySize(app: Application): { width: number; height: number } {
  return {
    width: app.screen.width,
    height: app.screen.height,
  };
}

function drawRectStroked(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  lineWidth: number,
  alpha = 1
): void {
  graphics.rect(x, y, width, height).stroke({ color, width: lineWidth, alpha });
}

function drawTriangle(
  graphics: Graphics,
  size: number,
  color: number,
  lineWidth: number
): void {
  const radius = size;
  graphics.moveTo(0, -radius);
  graphics.lineTo(-radius * 0.866, radius * 0.5);
  graphics.lineTo(radius * 0.866, radius * 0.5);
  graphics.closePath();
  graphics.fill({ color });
  graphics.stroke({ color, width: lineWidth });
}

export function spritePlugin<T extends RequirePlugin<[typeof ecsPlugin]>>(
  context: T
): ContextExtension<
  T,
  {
    canvas: HTMLCanvasElement | null;
    pixiApp: Application;
    pixiWorld: Container;
    pixiOverlay: Container;
    spriteClickProvider: ClickableEntityProvider;
  }
> {
  let canvas: HTMLCanvasElement | null = null;
  let isPixiReady = false;

  const app = new Application();
  const worldContainer = new Container();
  const overlayContainer = new Container();

  const spriteRecords = new Map<string, SpriteRecord>();
  const selectionGraphics = new Graphics();
  const originGraphics = new Graphics();

  const spriteClickProvider: ClickableEntityProvider = {
    checkClick: (worldX: number, worldY: number): string | null => {
      let clickedEntity: string | null = null;

      context.ecs.runQuery(
        [TransformComponentDefinition, SpriteComponentDefinition],
        (entity, { transform, sprite }) => {
          if (clickedEntity) return;
          if (transform && sprite && typeof sprite.width === "number") {
            const worldPos = getWorldPosition(context.ecs.ecsInstance, entity);
            if (!worldPos) return;

            const worldTransform = getWorldTransform(context.ecs.ecsInstance, entity);
            if (!worldTransform) return;

            const scaledWidth = sprite.width * worldTransform.scaleX;
            const scaledHeight = sprite.height * worldTransform.scaleY;

            const left = worldPos.x - scaledWidth / 2;
            const right = worldPos.x + scaledWidth / 2;
            const top = worldPos.y - scaledHeight / 2;
            const bottom = worldPos.y + scaledHeight / 2;
            if (
              worldX >= left &&
              worldX <= right &&
              worldY >= top &&
              worldY <= bottom
            ) {
              clickedEntity = entity;
            }
          }
        }
      );

      return clickedEntity;
    },
  };

  const prepareCanvas = () => {
    if (!canvas) return;
    canvas.style.display = "block";
    canvas.style.margin = "0";
    canvas.style.padding = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "auto";
    canvas.style.touchAction = "none";
  };

  const syncCanvasSize = () => {
    if (!canvas) return;
    const rect = context.rootElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    app.renderer.resize(rect.width, rect.height);
  };

  const createBaseDisplay = (sprite: SpriteComponent): SpriteRecord => {
    const container = new Container();
    let base: Sprite;
    let kind: SpriteRecord["kind"] = "color";
    let imageSrc: string | undefined;

    if (sprite.image) {
      const imageSprite = new Sprite(Texture.EMPTY);
      imageSprite.anchor.set(0.5);
      imageSprite.width = sprite.width;
      imageSprite.height = sprite.height;
      setSpriteTexture(imageSprite, sprite.image);
      base = imageSprite;
      kind = "image";
      imageSrc = sprite.image;
    } else {
      const colorSprite = new Sprite(Texture.WHITE);
      colorSprite.anchor.set(0.5);
      colorSprite.width = sprite.width;
      colorSprite.height = sprite.height;
      colorSprite.tint = Number.parseInt(sprite.color.replace("#", ""), 16);
      base = colorSprite;
      kind = "color";
    }

    const flashOverlay = new Sprite(Texture.WHITE);
    flashOverlay.anchor.set(0.5);
    flashOverlay.width = sprite.width;
    flashOverlay.height = sprite.height;
    flashOverlay.tint = 0xffffff;
    flashOverlay.alpha = 0;
    flashOverlay.visible = false;

    container.addChild(base);
    container.addChild(flashOverlay);

    return {
      container,
      base,
      flashOverlay,
      kind,
      imageSrc,
      width: sprite.width,
      height: sprite.height,
      color: sprite.color,
    };
  };

  const updateBaseDisplay = (record: SpriteRecord, sprite: SpriteComponent) => {
    const needsTypeSwap =
      (sprite.image && record.kind !== "image") ||
      (!sprite.image && record.kind !== "color");

    if (needsTypeSwap) {
      record.container.removeChild(record.base);
      record.base.destroy();
      const newRecord = createBaseDisplay(sprite);
      record.base = newRecord.base;
      record.kind = newRecord.kind;
      record.imageSrc = newRecord.imageSrc;
      record.width = newRecord.width;
      record.height = newRecord.height;
      record.color = newRecord.color;
      record.container.addChildAt(record.base, 0);
    }

    if (record.kind === "image" && sprite.image) {
      if (record.imageSrc !== sprite.image) {
        setSpriteTexture(record.base as Sprite, sprite.image);
        record.imageSrc = sprite.image;
      }
      if (record.width !== sprite.width || record.height !== sprite.height) {
        const imageSprite = record.base as Sprite;
        imageSprite.width = sprite.width;
        imageSprite.height = sprite.height;
      }
    } else if (record.kind === "color") {
      const colorSprite = record.base as Sprite;
      if (record.color !== sprite.color) {
        colorSprite.tint = Number.parseInt(sprite.color.replace("#", ""), 16);
      }
      if (record.width !== sprite.width || record.height !== sprite.height) {
        colorSprite.width = sprite.width;
        colorSprite.height = sprite.height;
      }
    }

    if (record.width !== sprite.width || record.height !== sprite.height) {
      record.flashOverlay.width = sprite.width;
      record.flashOverlay.height = sprite.height;
    }

    record.width = sprite.width;
    record.height = sprite.height;
    record.color = sprite.color;
  };

  const extendedContext = {
    ...context,
    canvas: null as HTMLCanvasElement | null,
    pixiApp: app,
    pixiWorld: worldContainer,
    pixiOverlay: overlayContainer,
    spriteClickProvider,
  };

  const existingCanvas = context.rootElement.querySelector("canvas");
  if (existingCanvas) {
    canvas = existingCanvas as HTMLCanvasElement;
  } else {
    canvas = document.createElement("canvas");
    context.rootElement.appendChild(canvas);
  }
  prepareCanvas();
  extendedContext.canvas = canvas;

  const finalizePixiInit = () => {
    app.stage.addChild(worldContainer);
    app.stage.addChild(overlayContainer);
    overlayContainer.addChild(selectionGraphics);
    overlayContainer.addChild(originGraphics);

    app.ticker.stop();
    isPixiReady = true;
    syncCanvasSize();
  };

  const initPixi = async () => {
    // Ensure PIXI is available on the iframe window for runtime integrations.
    (globalThis as typeof globalThis & { PIXI?: typeof PIXI }).PIXI ??= PIXI;

    try {
      await app.init({
        canvas,
        resizeTo: context.rootElement,
        antialias: false,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        powerPreference: "high-performance",
        preference: "webgl",
      });
      finalizePixiInit();
    } catch (error) {
      console.warn("PixiJS WebGL init failed, retrying with canvas renderer.", error);
      try {
        await app.init({
          canvas,
          resizeTo: context.rootElement,
          antialias: false,
          backgroundAlpha: 0,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          powerPreference: "high-performance",
          preference: "canvas",
        });
        finalizePixiInit();
      } catch (fallbackError) {
        console.error("Failed to initialize PixiJS:", fallbackError);
      }
    }
  };

  void initPixi();

  addDrawCallback(() => {
    if (!isPixiReady) return;
    if (app.renderer.width === 0 || app.renderer.height === 0) {
      syncCanvasSize();
    }

    const viewport = getViewport();
    const { width: displayWidth, height: displayHeight } = getDisplaySize(app);
    const worldOffsetX = displayWidth / 2 - viewport.x * viewport.scale;
    const worldOffsetY = displayHeight / 2 - viewport.y * viewport.scale;

    worldContainer.position.set(worldOffsetX, worldOffsetY);
    worldContainer.scale.set(viewport.scale);
    overlayContainer.position.set(worldOffsetX, worldOffsetY);
    overlayContainer.scale.set(viewport.scale);

    originGraphics.clear();
    if (isEditorMode() && !isUpdateEnabled()) {
      drawTriangle(originGraphics, 8, 0x00ffff, 1 / viewport.scale);
    }

    selectionGraphics.clear();

    const selectedEntity = context.ecs.getSelectedEntity();

    const seenEntities = new Set<string>();

    context.ecs.runQuery(
      [TransformComponentDefinition, SpriteComponentDefinition],
      (entity, { sprite, hitFlash }) => {
        const worldTransform = getWorldTransform(context.ecs.ecsInstance, entity);
        if (!worldTransform) return;

        const worldPos = getWorldPosition(context.ecs.ecsInstance, entity);
        if (!worldPos) return;

        const typedHitFlash = hitFlash as HitFlashComponent | undefined;
        const isFlashing =
          typedHitFlash && typedHitFlash.flashTime < typedHitFlash.maxFlashTime;
        const flashIntensity = isFlashing
          ? 1 - typedHitFlash!.flashTime / typedHitFlash!.maxFlashTime
          : 0;

        let record = spriteRecords.get(entity);
        if (!record) {
          record = createBaseDisplay(sprite);
          spriteRecords.set(entity, record);
          worldContainer.addChild(record.container);
        } else {
          updateBaseDisplay(record, sprite);
        }

        record.container.position.set(worldPos.x, worldPos.y);
        record.container.rotation = (worldTransform.rotation * Math.PI) / 180;
        record.container.scale.set(worldTransform.scaleX, worldTransform.scaleY);

        if (isFlashing) {
          record.flashOverlay.visible = true;
          record.flashOverlay.alpha = flashIntensity * 0.7;
        } else {
          record.flashOverlay.visible = false;
          record.flashOverlay.alpha = 0;
        }

        if (selectedEntity === entity) {
          const scaledWidth = sprite.width * worldTransform.scaleX;
          const scaledHeight = sprite.height * worldTransform.scaleY;
          const padding = 2 / viewport.scale;
          drawRectStroked(
            selectionGraphics,
            worldPos.x - scaledWidth / 2 - padding,
            worldPos.y - scaledHeight / 2 - padding,
            scaledWidth + padding * 2,
            scaledHeight + padding * 2,
            0x00ffff,
            2 / viewport.scale
          );
        }

        seenEntities.add(entity);
      }
    );

    for (const [entity, record] of spriteRecords.entries()) {
      if (seenEntities.has(entity)) continue;
      worldContainer.removeChild(record.container);
      record.container.destroy({ children: true });
      spriteRecords.delete(entity);
    }

    app.renderer.render(app.stage);
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      app.destroy({ removeView: true });
    });
  }

  return extendedContext;
}
