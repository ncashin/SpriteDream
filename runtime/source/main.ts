import {
  initializeGameContext as initializeGameContext,
  type InitialGameContext,
} from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import {
  spritePlugin,
  SpriteComponentDefinition,
  type SpriteComponent,
} from "./core/sprite";
import { inputPlugin } from "./core/input";
import { ecsEditorPlugin } from "./core/ecs/editor/ECSEditorPlugin.tsx";
import { viewportDebugPlugin } from "./core/viewport/viewportDebugPlugin";
import { addStartCallback } from "./core/initialization";
import { addUpdateCallback, addEditorCallback } from "./core/gameloop";
import type { Component } from "./core/ecs/ecs";
import {
  PositionComponentDefinition,
  type PositionComponent,
  defineComponent,
} from "./core/ecs/component";
import {
  getViewport,
  setViewport,
  resetViewport,
  zoomViewport,
} from "./core/viewport/viewport";
import initialScene from "../scenes/default.scene?raw";

// Export viewport functions for programmatic access
export {
  getViewport,
  setViewport,
  updateViewport,
  resetViewport,
  setViewportScale,
  zoomViewport,
} from "./core/viewport/viewport";

export type PlatformComponent = Component & {
  type: "platform";
};
export const PlatformComponentDefinition: PlatformComponent = defineComponent(
  {
    type: "platform",
  },
  {
    displayName: "Platform",
    description: "A platform entity",
  }
);

export type PlayerComponent = Component & {
  type: "player";
  speed: number;
  gravity: number;
  jumpStrength: number;
  isGrounded: boolean;
};
export const PlayerComponentDefinition: PlayerComponent = defineComponent(
  {
    type: "player",
    speed: 0,
    gravity: 0,
    jumpStrength: 0,
    isGrounded: false,
  },
  {
    displayName: "Player",
    description: "Player-controlled entity",
  }
);

function checkAABBCollision(
  pos1: PositionComponent,
  sprite1: SpriteComponent,
  pos2: PositionComponent,
  sprite2: SpriteComponent
): boolean {
  const left1 = pos1.x - sprite1.width / 2;
  const right1 = pos1.x + sprite1.width / 2;
  const top1 = pos1.y - sprite1.height / 2;
  const bottom1 = pos1.y + sprite1.height / 2;

  const left2 = pos2.x - sprite2.width / 2;
  const right2 = pos2.x + sprite2.width / 2;
  const top2 = pos2.y - sprite2.height / 2;
  const bottom2 = pos2.y + sprite2.height / 2;

  return left1 < right2 && right1 > left2 && top1 < bottom2 && bottom1 > top2;
}

export type EditorDragCallback = (
  entityId: string,
  newX: number,
  newY: number
) => void;

let editorDragCallback: EditorDragCallback | null = null;

export function setEditorDragCallback(callback: EditorDragCallback | null) {
  editorDragCallback = callback;
}

export function main(initialContext: InitialGameContext) {
  const gameContext = initializeGameContext({
    initialContext,
    plugins: [
      ecsPlugin,
      spritePlugin,
      inputPlugin,
      ecsEditorPlugin,
      viewportDebugPlugin,
    ],
    initialScene,
  });

  const playerEntityId = "player";
  let playerEntity: any | null = null;

  addStartCallback(() => {
    // Reset viewport to 0, 0 when starting the game
    resetViewport();

    playerEntity = gameContext.ecs.getEntity(playerEntityId);

    if (playerEntity.player && playerEntity.player.isGrounded === undefined) {
      playerEntity.player.isGrounded = false;
    }

    const component = document.createElement("div");
    component.textContent = "Game started!";
    gameContext.rootElement.appendChild(component);
  });

  addUpdateCallback((deltaTime: number) => {
    if (
      !playerEntity ||
      !playerEntity.position ||
      !playerEntity.velocity ||
      !playerEntity.player ||
      !playerEntity.sprite
    )
      return;

    const speed = playerEntity.player.speed;
    const moveDistance = speed * deltaTime;
    const gravity = playerEntity.player.gravity;
    const jumpStrength = playerEntity.player.jumpStrength;

    if (gameContext.input.isKeyPressed("a")) {
      playerEntity.position.x -= moveDistance;
    }
    if (gameContext.input.isKeyPressed("d")) {
      playerEntity.position.x += moveDistance;
    }

    if (gameContext.input.isKeyPressed(" ") && playerEntity.player.isGrounded) {
      playerEntity.velocity.y = -jumpStrength;
    }

    playerEntity.velocity.y += gravity * deltaTime;
    playerEntity.position.y += playerEntity.velocity.y * deltaTime;

    playerEntity.player.isGrounded = false;
    gameContext.ecs.runQuery(
      [
        PositionComponentDefinition,
        SpriteComponentDefinition,
        PlatformComponentDefinition,
      ],
      (
        _entity: string,
        components: [PositionComponent, SpriteComponent, PlatformComponent]
      ) => {
        const [platformPos, platformSprite] = components;

        if (
          checkAABBCollision(
            playerEntity.position,
            playerEntity.sprite,
            platformPos,
            platformSprite
          )
        ) {
          const platformTopY = platformPos.y - platformSprite.height / 2;
          const platformBottomY = platformPos.y + platformSprite.height / 2;
          const playerTopY =
            playerEntity.position.y - playerEntity.sprite.height / 2;
          const playerBottomY =
            playerEntity.position.y + playerEntity.sprite.height / 2;

          if (playerEntity.velocity.y >= 0 && playerBottomY > platformTopY) {
            playerEntity.position.y =
              platformTopY - playerEntity.sprite.height / 2;
            playerEntity.velocity.y = 0;
            playerEntity.player.isGrounded = true;
          } else if (
            playerEntity.velocity.y < 0 &&
            playerTopY < platformBottomY
          ) {
            playerEntity.position.y =
              platformBottomY + playerEntity.sprite.height / 2;
            playerEntity.velocity.y = 0;
          }
        }
      }
    );
  });

  let draggedEntityId: string | null = null;
  let dragStartEntityX: number = 0;
  let dragStartEntityY: number = 0;
  let isDraggingViewport: boolean = false;
  let viewportDragStartX: number = 0;
  let viewportDragStartY: number = 0;

  // Handle mouse wheel for zooming
  let wheelHandler: ((e: WheelEvent) => void) | null = null;

  addEditorCallback(() => {
    const mousePos = gameContext.input.getMousePosition();
    const isMouseDown = gameContext.input.isMouseButtonPressed("left");
    const viewport = getViewport();

    // Set up wheel handler if not already set
    if (!wheelHandler) {
      wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        // Get mouse position from the event (relative to canvas)
        const rect = gameContext.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -0.03 : 0.03;
        zoomViewport(delta, x, y);
      };
      gameContext.canvas.addEventListener("wheel", wheelHandler, {
        passive: false,
      });
    }

    // Convert screen coordinates to world coordinates (accounting for scale)
    // Screen to world: world = (screen / scale) + viewport
    const worldMouseX = mousePos.x / viewport.scale + viewport.x;
    const worldMouseY = mousePos.y / viewport.scale + viewport.y;

    if (isMouseDown && !gameContext.input.getDragState().isDragging) {
      let clickedEntity: string | null = null;

      gameContext.ecs.runQuery(
        [PositionComponentDefinition, SpriteComponentDefinition],
        (entity, components) => {
          if (clickedEntity) return;

          const [position, sprite] = components;

          const left = position.x - sprite.width / 2;
          const right = position.x + sprite.width / 2;
          const top = position.y - sprite.height / 2;
          const bottom = position.y + sprite.height / 2;

          if (
            worldMouseX >= left &&
            worldMouseX <= right &&
            worldMouseY >= top &&
            worldMouseY <= bottom
          ) {
            clickedEntity = entity;
            draggedEntityId = entity;
            dragStartEntityX = position.x;
            dragStartEntityY = position.y;
            gameContext.input.startDrag(mousePos.x, mousePos.y);
          }
        }
      );

      // If no entity was clicked, start dragging the viewport
      if (!clickedEntity) {
        isDraggingViewport = true;
        viewportDragStartX = viewport.x;
        viewportDragStartY = viewport.y;
        gameContext.input.startDrag(mousePos.x, mousePos.y);
      }
    }

    if (gameContext.input.getDragState().isDragging) {
      gameContext.input.updateDrag(mousePos.x, mousePos.y);
      const dragState = gameContext.input.getDragState();

      if (draggedEntityId) {
        // Drag entity (accounting for scale)
        const entity = gameContext.ecs.getEntity(draggedEntityId);
        if (entity && entity.position) {
          const newX = dragStartEntityX + dragState.offsetX / viewport.scale;
          const newY = dragStartEntityY + dragState.offsetY / viewport.scale;
          entity.position.x = newX;
          entity.position.y = newY;

          if (editorDragCallback) {
            editorDragCallback(draggedEntityId, newX, newY);
          }
        }
      } else if (isDraggingViewport) {
        // If viewport was reset while dragging (was at non-zero, now at 0,0,1), end the drag
        if (
          viewport.x === 0 &&
          viewport.y === 0 &&
          viewport.scale === 1 &&
          (viewportDragStartX !== 0 || viewportDragStartY !== 0)
        ) {
          gameContext.input.endDrag();
          isDraggingViewport = false;
        } else {
          // Normal drag update
          const newViewportX =
            viewportDragStartX - dragState.offsetX / viewport.scale;
          const newViewportY =
            viewportDragStartY - dragState.offsetY / viewport.scale;
          setViewport(newViewportX, newViewportY);
        }
      }
    }

    if (!isMouseDown && gameContext.input.getDragState().isDragging) {
      gameContext.input.endDrag();
      draggedEntityId = null;
      isDraggingViewport = false;
    }
  });
}
