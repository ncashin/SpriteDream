import type { ContextExtension, RequirePlugin } from "./gameContext";
import type { Component, ClickableEntityProvider } from "./ecs/ecs";
import {
  TransformComponentDefinition,
  defineComponent,
} from "./ecs/component";
import { ecsPlugin } from "./scene/ecsAdapter";
import { addDrawCallback, isUpdateEnabled } from "./gameloop";
import { getViewport } from "./viewport/viewportPlugin";
import { getWorldTransform, getWorldPosition } from "./transform";
import { isEditorMode } from "./utils";

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

let resizeHandler: (() => void) | null = null;

const imageCache = new Map<string, HTMLImageElement>();
const imageLoadPromises = new Map<string, Promise<HTMLImageElement>>();

function getImage(path: string): HTMLImageElement | null {
  const normalizedPath = normalizeAssetPath(path);

  const cached = imageCache.get(normalizedPath);
  if (cached && cached.complete) {
    return cached;
  }

  if (imageLoadPromises.has(normalizedPath)) {
    return null;
  }

  const img = new Image();
  const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => {
      imageCache.set(normalizedPath, img);
      imageLoadPromises.delete(normalizedPath);
      resolve(img);
    };
    img.onerror = () => {
      console.warn(`Failed to load image: ${path}`);
      imageLoadPromises.delete(normalizedPath);
      reject(new Error(`Failed to load image: ${path}`));
    };
    img.src = normalizedPath;
  });

  imageLoadPromises.set(normalizedPath, loadPromise);

  if (img.complete) {
    imageCache.set(normalizedPath, img);
    imageLoadPromises.delete(normalizedPath);
    return img;
  }

  return null;
}

function updateCanvasResolution(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = window.innerWidth;
  const displayHeight = window.innerHeight;

  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
}

function initializeCanvas(parent: HTMLElement): HTMLCanvasElement {
  let canvas = parent.querySelector("canvas") as HTMLCanvasElement | null;

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.margin = "0";
    canvas.style.padding = "0";
    canvas.style.pointerEvents = "auto";
    canvas.style.touchAction = "none";

    updateCanvasResolution(canvas);

    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
    }
    resizeHandler = () => {
      updateCanvasResolution(canvas!);
    };
    window.addEventListener("resize", resizeHandler);

    parent.appendChild(canvas);
  } else {
    updateCanvasResolution(canvas);
  }

  return canvas;
}

function normalizeAssetPath(src: string): string {
  if (src.startsWith('/') && !src.startsWith('//')) {
    return src.slice(1);
  }
  return src;
}

export function spritePlugin<T extends RequirePlugin<[typeof ecsPlugin]>>(
  context: T
): ContextExtension<
  T,
  {
    canvas: HTMLCanvasElement;
    context2D: CanvasRenderingContext2D;
    spriteClickProvider: ClickableEntityProvider;
  }
> {
  const canvas = initializeCanvas(context.rootElement);
  const context2D = canvas.getContext("2d");

  if (!context2D) {
    throw new Error("Failed to get 2D rendering context from canvas");
  }

  context2D.imageSmoothingEnabled = true;
  context2D.imageSmoothingQuality = "high";

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


  addDrawCallback(() => {
    if (!canvas || !context2D) return;

    context2D.imageSmoothingEnabled = true;
    context2D.imageSmoothingQuality = "high";

    const dpr = window.devicePixelRatio || 1;
    context2D.setTransform(dpr, 0, 0, dpr, 0, 0);

    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;
    context2D.clearRect(0, 0, displayWidth, displayHeight);

    const viewport = getViewport();
    const selectedEntity = context.ecs.getSelectedEntity();

    context2D.save();

    context2D.translate(displayWidth / 2, displayHeight / 2);
    context2D.scale(viewport.scale, viewport.scale);
    context2D.translate(-viewport.x, -viewport.y);

    if (isEditorMode() && !isUpdateEnabled()) {
      context2D.save();
      context2D.strokeStyle = "#00ffff";
      context2D.fillStyle = "#00ffff";
      context2D.lineWidth = 1 / viewport.scale;

      const size = 8;
      const radius = size;

      context2D.beginPath();
      context2D.moveTo(0, -radius);
      context2D.lineTo(-radius * 0.866, radius * 0.5);
      context2D.lineTo(radius * 0.866, radius * 0.5);
      context2D.closePath();
      context2D.fill();
      context2D.stroke();
      context2D.restore();
    }

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

        const rotationRad = (worldTransform.rotation * Math.PI) / 180;
        const isSelected = selectedEntity === entity;

        const scaledWidth = sprite.width * worldTransform.scaleX;
        const scaledHeight = sprite.height * worldTransform.scaleY;

        context2D.save();
        if (rotationRad !== 0) {
          context2D.translate(worldPos.x, worldPos.y);
          context2D.rotate(rotationRad);
          context2D.translate(-worldPos.x, -worldPos.y);
        }

        if (sprite.image) {
          const img = getImage(sprite.image);

          if (img) {
            context2D.drawImage(
              img,
              worldPos.x - scaledWidth / 2,
              worldPos.y - scaledHeight / 2,
              scaledWidth,
              scaledHeight
            );
            if (isFlashing) {
              context2D.save();
              context2D.globalCompositeOperation = "source-atop";
              context2D.globalAlpha = flashIntensity * 0.7;
              context2D.fillStyle = "#ffffff";
              context2D.fillRect(
                worldPos.x - scaledWidth / 2,
                worldPos.y - scaledHeight / 2,
                scaledWidth,
                scaledHeight
              );
              context2D.restore();
            }
          } else {
            context2D.fillStyle = sprite.color;
            context2D.fillRect(
              worldPos.x - scaledWidth / 2,
              worldPos.y - scaledHeight / 2,
              scaledWidth,
              scaledHeight
            );
          }
        } else {
          context2D.fillStyle = sprite.color;
          context2D.fillRect(
            worldPos.x - scaledWidth / 2,
            worldPos.y - scaledHeight / 2,
            scaledWidth,
            scaledHeight
          );
          if (isFlashing) {
            context2D.save();
            context2D.globalAlpha = flashIntensity * 0.7;
            context2D.fillStyle = "#ffffff";
            context2D.fillRect(
              worldPos.x - scaledWidth / 2,
              worldPos.y - scaledHeight / 2,
              scaledWidth,
              scaledHeight
            );
            context2D.restore();
          }
        }

        if (isSelected) {
          context2D.save();
          context2D.strokeStyle = "#00ffff";
          context2D.lineWidth = 2 / viewport.scale;

          const padding = 2 / viewport.scale;
          const left = worldPos.x - scaledWidth / 2 - padding;
          const top = worldPos.y - scaledHeight / 2 - padding;
          const right = worldPos.x + scaledWidth / 2 + padding;
          const bottom = worldPos.y + scaledHeight / 2 + padding;

          context2D.strokeRect(left, top, right - left, bottom - top);
          context2D.restore();
        }

        context2D.restore();
      }
    );

    context2D.restore();
  });

  return {
    ...context,
    canvas,
    context2D,
    spriteClickProvider,
  };
}
