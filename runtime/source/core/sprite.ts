import type { ContextExtension, RequirePlugin, ClickableEntityProvider } from "./gameContext";
import type { Component, Entity } from "./ecs/ecs";
import {
  PositionComponentDefinition,
  type PositionComponent,
  defineComponent,
} from "./ecs/component";
import { ecsPlugin } from "./scene/ecsAdapter";
import { addDrawCallback, isEditorEnabled } from "./gameloop";
import { getViewport } from "./viewport/viewportPlugin";
import type { HitFlashComponent } from "../scripts/boss";
import { DamageNumberComponentDefinition } from "../scripts/damageNumber";
import type { DamageNumberComponent } from "../scripts/damageNumber";

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
  }
);

function initializeCanvas(parent: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;

  const resizeCanvas = () => {
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    // Set the actual canvas size in memory (scaled by device pixel ratio)
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // Set the display size (CSS pixels)
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
  };

  resizeCanvas();

  canvas.style.display = "block";
  canvas.style.margin = "0";
  canvas.style.padding = "0";
  canvas.style.pointerEvents = "auto";
  canvas.style.touchAction = "none";

  window.addEventListener("resize", resizeCanvas);

  parent.appendChild(canvas);

  return canvas;
}

const imageCache = new Map<string, HTMLImageElement>();

/**
 * Normalizes asset paths to work correctly with Vite and the bundle API.
 * Converts absolute paths (starting with /) to relative paths so they
 * resolve correctly with the base tag in the bundle context.
 */
function normalizeAssetPath(src: string): string {
  // If it's an absolute path (starts with / but not //), make it relative
  // This allows the base tag to resolve it correctly in the bundle
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
  const context2D = canvas.getContext("2d", {
    alpha: true,
    desynchronized: false,
  });

  if (!context2D) {
    throw new Error("Failed to get 2D rendering context from canvas");
  }

  // Enable high-quality image smoothing for crisp rendering
  context2D.imageSmoothingEnabled = true;
  context2D.imageSmoothingQuality = "high";

  // Scale the context to account for device pixel ratio
  const dpr = window.devicePixelRatio || 1;

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
    // Clear the entire canvas
    context2D.clearRect(0, 0, canvas.width, canvas.height);

    // Reset transform and apply device pixel ratio scaling
    context2D.setTransform(dpr, 0, 0, dpr, 0, 0);

    const viewport = getViewport();
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    context2D.save();

    // Transform to world coordinates (using display dimensions, not canvas dimensions)
    context2D.translate(displayWidth / 2, displayHeight / 2);
    context2D.scale(viewport.scale, viewport.scale);
    context2D.translate(-viewport.x, -viewport.y);

    // Only draw origin in editor mode
    if (isEditorEnabled()) {
      context2D.save();
      context2D.strokeStyle = "#00ffff";
      context2D.fillStyle = "#00ffff";
      context2D.lineWidth = 1 / viewport.scale;

      const radius = 4;

      context2D.beginPath();
      context2D.arc(0, 0, radius, 0, Math.PI * 2);
      context2D.fill();
      context2D.restore();
    }

    const selectedEntity = context.ecs.getSelectedEntity();
    const inEditorMode = isEditorEnabled();

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

        // Check if entity has hit flash
        const isFlashing =
          hitFlash && hitFlash.flashTime < hitFlash.maxFlashTime;
        const flashIntensity = isFlashing
          ? 1 - hitFlash!.flashTime / hitFlash!.maxFlashTime
          : 0;

        // Get rotation from player component if available
        const rotation = player?.rotation || 0;

        // Calculate sprite bounds
        const spriteX = position.x - sprite.width / 2;
        const spriteY = position.y - sprite.height / 2;

        context2D.save();

        // Apply rotation if needed
        if (rotation !== 0) {
          context2D.translate(position.x, position.y);
          context2D.rotate(rotation);
          context2D.translate(-position.x, -position.y);
        }

        if (sprite.image) {
          const normalizedImagePath = normalizeAssetPath(sprite.image);
          const img = imageCache.get(normalizedImagePath);

          if (img && img.complete) {
            // Draw the image
            context2D.drawImage(
              img,
              spriteX,
              spriteY,
              sprite.width,
              sprite.height
            );

            // Apply white flash overlay only on image pixels
            if (isFlashing) {
              context2D.save();
              context2D.globalCompositeOperation = "source-atop";
              context2D.globalAlpha = flashIntensity * 0.7;
              context2D.fillStyle = "#ffffff";
              context2D.fillRect(spriteX, spriteY, sprite.width, sprite.height);
              context2D.restore();
            }
          } else {
            // Draw placeholder while image loads
            context2D.fillStyle = sprite.color;
            context2D.fillRect(spriteX, spriteY, sprite.width, sprite.height);

            // Apply white flash overlay
            if (isFlashing) {
              context2D.save();
              context2D.globalAlpha = flashIntensity * 0.7;
              context2D.fillStyle = "#ffffff";
              context2D.fillRect(spriteX, spriteY, sprite.width, sprite.height);
              context2D.restore();
            }

            // Load image if not already loading
            if (img === undefined) {
              loadImage(sprite.image).catch((error) => {
                console.warn(`Failed to load image: ${sprite.image}`, error);
              });
            }
          }
        } else {
          // Draw colored rectangle
          context2D.fillStyle = sprite.color;
          context2D.fillRect(spriteX, spriteY, sprite.width, sprite.height);

          // Apply white flash overlay
          if (isFlashing) {
            context2D.save();
            context2D.globalAlpha = flashIntensity * 0.7;
            context2D.fillStyle = "#ffffff";
            context2D.fillRect(spriteX, spriteY, sprite.width, sprite.height);
            context2D.restore();
          }
        }

        context2D.restore();

        // Draw selection indicator
        if (inEditorMode && selectedEntity === entity) {
          context2D.save();

          // Apply rotation if needed for selection box
          if (rotation !== 0) {
            context2D.translate(position.x, position.y);
            context2D.rotate(rotation);
            context2D.translate(-position.x, -position.y);
          }

          const padding = 3;
          const selectionX = position.x - sprite.width / 2 - padding;
          const selectionY = position.y - sprite.height / 2 - padding;
          const selectionWidth = sprite.width + padding * 2;
          const selectionHeight = sprite.height + padding * 2;

          // Draw solid border with crisp lines
          context2D.strokeStyle = "#00bfff";
          context2D.lineWidth = 1.5 / viewport.scale;
          context2D.setLineDash([]);
          context2D.strokeRect(selectionX, selectionY, selectionWidth, selectionHeight);

          context2D.restore();
        }
      }
    );

    // Render damage numbers
    context.ecs.runQuery(
      [PositionComponentDefinition, DamageNumberComponentDefinition],
      (
        _entity: Entity,
        components: [PositionComponent, DamageNumberComponent]
      ) => {
        const [position, damageNumber] = components;

        const ageRatio = damageNumber.lifetime / damageNumber.maxLifetime;
        // Smooth fade in at start, then fade out
        const fadeInTime = 0.1; // Quick fade in
        const alpha =
          ageRatio < fadeInTime
            ? ageRatio / fadeInTime // Fade in
            : 1 - Math.pow((ageRatio - fadeInTime) / (1 - fadeInTime), 2); // Smooth fade out

        context2D.save();
        context2D.globalAlpha = alpha;

        // White color
        context2D.fillStyle = "#ffffff";
        context2D.strokeStyle = "#000000";
        context2D.lineWidth = 1 / viewport.scale;

        const fontSize = 16 / viewport.scale;
        context2D.font = `bold ${fontSize}px Arial`;
        context2D.textAlign = "center";
        context2D.textBaseline = "middle";

        const text = `-${Math.round(damageNumber.damage)}`;

        // Draw text with outline for better visibility
        context2D.strokeText(text, position.x, position.y);
        context2D.fillText(text, position.x, position.y);

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
