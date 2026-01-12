import { addUpdateCallback } from "../core/gameloop";
import {
  PositionComponentDefinition,
  defineComponent,
  type PositionComponent,
} from "../core/ecs/component";
import type { Component } from "../core/ecs/ecs";
import { getViewport } from "../core/viewport/viewport";

export type WeaponComponent = Component & {
  type: "weapon";
  range: number;
  playerId: string;
};

export const WeaponComponentDefinition: WeaponComponent = defineComponent(
  {
    type: "weapon",
    range: 50,
    playerId: "player",
  },
  {
    displayName: "Weapon",
    description: "Weapon that points towards the mouse",
  }
);

export function initializeWeapon(gameContext: {
  ecs: ReturnType<typeof import("../core/ecs/ecs").curryECSInstance>;
  input: {
    getMousePosition: () => { x: number; y: number };
  };
  canvas: HTMLCanvasElement;
}) {
  addUpdateCallback(() => {
    const mouseScreenPos = gameContext.input.getMousePosition();

    const viewport = getViewport();
    const centerX = gameContext.canvas.width / 2;
    const centerY = gameContext.canvas.height / 2;
    const mouseWorldX =
      (mouseScreenPos.x - centerX) / viewport.scale + viewport.x;
    const mouseWorldY =
      (mouseScreenPos.y - centerY) / viewport.scale + viewport.y;

    gameContext.ecs.runQuery(
      [PositionComponentDefinition, WeaponComponentDefinition],
      (_weaponEntityId, components) => {
        const [weaponPosition, weapon] = components as [
          PositionComponent,
          WeaponComponent
        ];

        // Find the player position for this weapon's playerId
        const playerEntity = gameContext.ecs.getEntity(weapon.playerId);
        const playerPosition = playerEntity?.position as
          | PositionComponent
          | undefined;

        if (!playerPosition) return;

        const dx = mouseWorldX - playerPosition.x;
        const dy = mouseWorldY - playerPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const normalizedX = dx / distance;
          const normalizedY = dy / distance;

          weaponPosition.x = playerPosition.x + normalizedX * weapon.range;
          weaponPosition.y = playerPosition.y + normalizedY * weapon.range;
        } else {
          weaponPosition.x = playerPosition.x + weapon.range;
          weaponPosition.y = playerPosition.y;
        }
      }
    );
  });
}
