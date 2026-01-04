import type { ContextExtension, RequirePlugin } from "./gameContext";
import type { Entity } from "./ecs/ecs";
import {
  PositionComponentDefinition,
  SpriteComponentDefinition,
  type PositionComponent,
  type SpriteComponent,
} from "./defaultComponents";
import { sceneECSPlugin } from "./scene/ecsAdapter";

function initializeSprite(parent: HTMLElement): HTMLCanvasElement {
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

export interface SpriteRenderer {
  renderSprites: () => void;
  clear: () => void;
}

export function spritePlugin<
  T extends RequirePlugin<[typeof sceneECSPlugin]>
>(
  context: T
): ContextExtension<
  T,
  { canvas: HTMLCanvasElement; spriteRenderer: SpriteRenderer }
> {
  const canvas = initializeSprite(context.rootElement);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get 2D rendering context from canvas");
  }

  const spriteRenderer: SpriteRenderer = {
    renderSprites: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      context.ecs.runQuery(
        [PositionComponentDefinition, SpriteComponentDefinition],
        (_entity: Entity, components: [PositionComponent, SpriteComponent]) => {
          const [position, sprite] = components;

          ctx.fillStyle = sprite.color;
          ctx.fillRect(
            position.x - sprite.width / 2,
            position.y - sprite.height / 2,
            sprite.width,
            sprite.height
          );
        }
      );
    },
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };

  return {
    ...context,
    canvas,
    spriteRenderer,
  };
}
