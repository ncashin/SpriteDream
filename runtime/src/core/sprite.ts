import type { ContextExtension, RequirePlugin } from "./gameContext";
import type { Entity } from "./ecs/ecs";
import {
  PositionComponentDefinition,
  SpriteComponentDefinition,
  type PositionComponent,
  type SpriteComponent,
} from "./defaultComponents";
import { sceneECSPlugin } from "./scene/ecsAdapter";
import { addDrawCallback } from "./gameloop";

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
  { canvas: HTMLCanvasElement; context2D: CanvasRenderingContext2D }
> {
  const canvas = initializeSprite(context.rootElement);
  const context2D = canvas.getContext("2d");

  if (!context2D) {
    throw new Error("Failed to get 2D rendering context from canvas");
  }

  addDrawCallback(() => {
    context.ecs.runQuery(
      [PositionComponentDefinition, SpriteComponentDefinition],
      (_entity: Entity, components: [PositionComponent, SpriteComponent]) => {
        const [position, sprite] = components;

        context2D.fillStyle = sprite.color;
        context2D.fillRect(
          position.x - sprite.width / 2,
          position.y - sprite.height / 2,
          sprite.width,
          sprite.height
        );
      }
    );
  })

  return {
    ...context,
    canvas,
    context2D,
  };
}
