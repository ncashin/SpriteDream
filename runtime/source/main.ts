import {
  initializeGameContext as initializeGameContext,
  type InitialGameContext,
} from "./core/gameContext";
import { ecsPlugin } from "./core/scene/ecsAdapter";
import { spritePlugin, SpriteComponentDefinition } from "./core/sprite";
import { inputPlugin } from "./core/input";
import { ecsEditorPlugin } from "./core/ecs/editor/ECSEditorPlugin.tsx";
import { viewportDebugPlugin } from "./core/viewport/viewportDebugPlugin";
import { collisionPlugin } from "./core/collision/collisionPlugin";
import { addStartCallback } from "./core/initialization";
import { addUpdateCallback, addEditorCallback } from "./core/gameloop";
import type { Component } from "./core/ecs/ecs";
import {
  PositionComponentDefinition,
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
      collisionPlugin,
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
      !playerEntity.player
    )
      return;

    const speed = playerEntity.player.speed;
    const gravity = playerEntity.player.gravity;
    const jumpStrength = playerEntity.player.jumpStrength;

    // Check if grounded at the start of frame (based on previous frame's collision resolution)
    // The platformer resolver sets velocity.y to 0 when on top of something
    playerEntity.player.isGrounded = Math.abs(playerEntity.velocity.y) < 1;

    // Handle horizontal movement via velocity
    if (gameContext.input.isKeyPressed("a")) {
      playerEntity.velocity.x = -speed;
    } else if (gameContext.input.isKeyPressed("d")) {
      playerEntity.velocity.x = speed;
    } else {
      // Apply friction when no input
      playerEntity.velocity.x *= 0.8;
      if (Math.abs(playerEntity.velocity.x) < 1) {
        playerEntity.velocity.x = 0;
      }
    }

    // Handle jumping
    if (gameContext.input.isKeyPressed(" ") && playerEntity.player.isGrounded) {
      playerEntity.velocity.y = -jumpStrength;
      playerEntity.player.isGrounded = false;
    }

    // Apply gravity
    playerEntity.velocity.y += gravity * deltaTime;

    // Update position based on velocity (collision system will correct this)
    playerEntity.position.x += playerEntity.velocity.x * deltaTime;
    playerEntity.position.y += playerEntity.velocity.y * deltaTime;
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
