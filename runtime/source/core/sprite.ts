import type { ContextExtension, RequirePlugin } from "./gameContext";
import type { Component, Entity, ClickableEntityProvider } from "./ecs/ecs";
import {
  PositionComponentDefinition,
  type PositionComponent,
  defineComponent,
} from "./ecs/component";
import { ecsPlugin } from "./scene/ecsAdapter";
import { addDrawCallback } from "./gameloop";
import { getViewport } from "./viewport/viewportPlugin";
// HitFlashComponent type definition
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

function initializeCanvas(parent: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";
  canvas.style.margin = "0";
  canvas.style.padding = "0";
  canvas.style.pointerEvents = "auto";
  canvas.style.touchAction = "none";

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  parent.appendChild(canvas);

  return canvas;
}

const imageCache = new Map<string, HTMLImageElement>();

function normalizeAssetPath(src: string): string {
  if (src.startsWith('/') && !src.startsWith('//')) {
    return src.slice(1);
  }
  return src;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const normalizedSrc = normalizeAssetPath(src);

  if (imageCache.has(normalizedSrc)) {
    return Promise.resolve(imageCache.get(normalizedSrc)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(normalizedSrc, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = normalizedSrc;
  });
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

  const spriteClickProvider: ClickableEntityProvider = {
    checkClick: (worldX: number, worldY: number): string | null => {
      let clickedEntity: string | null = null;

      context.ecs.runQuery(
        [PositionComponentDefinition, SpriteComponentDefinition],
        (entity: Entity, components: [PositionComponent, SpriteComponent]) => {
          if (clickedEntity) return;
          const [position, sprite] = components;
          if (position && sprite && typeof position.x === "number" && typeof sprite.width === "number") {
            const left = position.x - sprite.width / 2;
            const right = position.x + sprite.width / 2;
            const top = position.y - sprite.height / 2;
            const bottom = position.y + sprite.height / 2;
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
    context2D.clearRect(0, 0, canvas.width, canvas.height);

    const viewport = getViewport();
    const selectedEntity = context.ecs.getSelectedEntity();

    context2D.save();

    context2D.translate(canvas.width / 2, canvas.height / 2);
    context2D.scale(viewport.scale, viewport.scale);
    context2D.translate(-viewport.x, -viewport.y);

    context2D.save();
    context2D.strokeStyle = "#00ffff";
    context2D.fillStyle = "#00ffff";
    context2D.lineWidth = 1 / viewport.scale;

    const size = 8;
    const radius = size;

    // Draw triangle pointing up
    context2D.beginPath();
    context2D.moveTo(0, -radius); // Top point
    context2D.lineTo(-radius * 0.866, radius * 0.5); // Bottom left (cos(120°) * radius, sin(120°) * radius)
    context2D.lineTo(radius * 0.866, radius * 0.5); // Bottom right (cos(60°) * radius, sin(60°) * radius)
    context2D.closePath();
    context2D.fill();
    context2D.stroke();
    context2D.restore();

    context.ecs.runQuery(
      [PositionComponentDefinition, SpriteComponentDefinition],
      (entity: Entity, components: [PositionComponent, SpriteComponent]) => {
        const [position, sprite] = components;
        const entityComponents = context.ecs.getEntity(entity);
        const hitFlash = entityComponents.hitFlash as
          | HitFlashComponent
          | undefined;
        const player = entityComponents.player as
          | { rotation?: number }
          | undefined;

        const isFlashing =
          hitFlash && hitFlash.flashTime < hitFlash.maxFlashTime;
        const flashIntensity = isFlashing
          ? 1 - hitFlash!.flashTime / hitFlash!.maxFlashTime
          : 0;

        const rotation = player?.rotation || 0;
        const isSelected = selectedEntity === entity;

        context2D.save();
        if (rotation !== 0) {
          context2D.translate(position.x, position.y);
          context2D.rotate(rotation);
          context2D.translate(-position.x, -position.y);
        }

        if (sprite.image) {
          const normalizedImagePath = normalizeAssetPath(sprite.image);
          const img = imageCache.get(normalizedImagePath);
          if (img && img.complete) {
            context2D.drawImage(
              img,
              position.x - sprite.width / 2,
              position.y - sprite.height / 2,
              sprite.width,
              sprite.height
            );
            if (isFlashing) {
              context2D.globalCompositeOperation = "source-atop";
              context2D.globalAlpha = flashIntensity * 0.7;
              context2D.fillStyle = "#ffffff";
              context2D.fillRect(
                position.x - sprite.width / 2,
                position.y - sprite.height / 2,
                sprite.width,
                sprite.height
              );
            }
          } else {
            context2D.fillStyle = sprite.color;
            context2D.fillRect(
              position.x - sprite.width / 2,
              position.y - sprite.height / 2,
              sprite.width,
              sprite.height
            );
            if (img === undefined) {
              loadImage(sprite.image).catch((error) => {
                console.warn(`Failed to load image: ${sprite.image}`, error);
              });
            }
          }
        } else {
          context2D.fillStyle = sprite.color;
          context2D.fillRect(
            position.x - sprite.width / 2,
            position.y - sprite.height / 2,
            sprite.width,
            sprite.height
          );
          if (isFlashing) {
            context2D.save();
            context2D.globalAlpha = flashIntensity * 0.7;
            context2D.fillStyle = "#ffffff";
            context2D.fillRect(
              position.x - sprite.width / 2,
              position.y - sprite.height / 2,
              sprite.width,
              sprite.height
            );
            context2D.restore();
          }
        }

        // Draw selection indicator
        if (isSelected) {
          context2D.save();
          context2D.strokeStyle = "#00ffff";
          context2D.lineWidth = 2 / viewport.scale;

          const padding = 2 / viewport.scale;
          const left = position.x - sprite.width / 2 - padding;
          const top = position.y - sprite.height / 2 - padding;
          const right = position.x + sprite.width / 2 + padding;
          const bottom = position.y + sprite.height / 2 + padding;

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
