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
import { addEditorCallback } from "./core/gameloop";
import { initializePlayer } from "./scripts/player";
// Import to register WeaponComponentDefinition in componentRegistry for editor UI
import { initializeWeapon, WeaponComponentDefinition } from "./scripts/weapon";
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

  initializePlayer(gameContext, "player");
  initializeWeapon(gameContext);

  addStartCallback(() => {
    const component = document.createElement("div");
    component.textContent = "Game started!";
    gameContext.rootElement.appendChild(component);

    // Create weapon entity if it doesn't exist or is missing components
    const weaponEntityId = "weapon";
    const weaponEntity = gameContext.ecs.getEntity(weaponEntityId);

    // Get player position to place weapon next to player
    const playerEntity = gameContext.ecs.getEntity("player");
    const playerPosition = playerEntity?.position;

    // Add position component if missing
    if (!weaponEntity?.position) {
      gameContext.ecs.addComponent(weaponEntityId, {
        ...PositionComponentDefinition,
        x: playerPosition?.x ?? 0,
        y: playerPosition?.y ?? 0,
      });
    }

    // Add sprite component so weapon is visible
    if (!weaponEntity?.sprite) {
      gameContext.ecs.addComponent(weaponEntityId, {
        ...SpriteComponentDefinition,
        width: 16,
        height: 16,
        color: "#ffff00",
      });
    }

    // Add weapon component
    if (!weaponEntity?.weapon) {
      gameContext.ecs.addComponent(weaponEntityId, {
        ...WeaponComponentDefinition,
        playerId: "player",
        range: 50,
      });
    }
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
      // Set default cursor to grab for viewport dragging
      gameContext.canvas.style.cursor = "grab";
    }

    // Convert screen coordinates to world coordinates
    // Screen to world: world = ((screen - center) / scale) + viewport
    const centerX = gameContext.canvas.width / 2;
    const centerY = gameContext.canvas.height / 2;
    const worldMouseX = (mousePos.x - centerX) / viewport.scale + viewport.x;
    const worldMouseY = (mousePos.y - centerY) / viewport.scale + viewport.y;

    // Check if hovering over an entity (when not dragging)
    let hoveringOverEntity = false;
    if (!gameContext.input.getDragState().isDragging && !isMouseDown) {
      gameContext.ecs.runQuery(
        [PositionComponentDefinition, SpriteComponentDefinition],
        (_entity, components) => {
          if (hoveringOverEntity) return;

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
            hoveringOverEntity = true;
          }
        }
      );
    }

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
        // Reset cursor when dragging entity
        gameContext.canvas.style.cursor = "move";
      } else if (isDraggingViewport) {
        // Set cursor to grabbing when dragging viewport
        gameContext.canvas.style.cursor = "grabbing";
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
          // Normal drag update - convert screen drag offset to world space
          const worldDeltaX = dragState.offsetX / viewport.scale;
          const worldDeltaY = dragState.offsetY / viewport.scale;
          // Move viewport center opposite to drag direction
          const newViewportX = viewportDragStartX - worldDeltaX;
          const newViewportY = viewportDragStartY - worldDeltaY;
          setViewport(newViewportX, newViewportY);
        }
      }
    } else {
      // Set cursor based on hover state when not dragging
      if (hoveringOverEntity) {
        gameContext.canvas.style.cursor = "move";
      } else {
        gameContext.canvas.style.cursor = "grab";
      }
    }

    if (!isMouseDown && gameContext.input.getDragState().isDragging) {
      gameContext.input.endDrag();
      draggedEntityId = null;
      isDraggingViewport = false;
      // Reset cursor when drag ends
      gameContext.canvas.style.cursor = "grab";
    }
  });
}
