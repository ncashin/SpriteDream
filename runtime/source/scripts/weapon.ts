import { addUpdateCallback } from "../core/gameloop";
import {
  PositionComponentDefinition,
  VelocityComponentDefinition,
  ColliderComponentDefinition,
  defineComponent,
  type PositionComponent,
} from "../core/ecs/component";
import { SpriteComponentDefinition } from "../core/sprite";
import type { Component } from "../core/ecs/ecs";
import { getViewport } from "../core/viewport/viewport";
import type { RequirePlugin } from "../core/gameContext";
import { ecsPlugin } from "../core/scene/ecsAdapter";
import { inputPlugin } from "../core/input";
import { spritePlugin } from "../core/sprite";
import { ProjectileComponentDefinition } from "./projectile";

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

export function initializeWeapon(
  gameContext: RequirePlugin<
    [typeof ecsPlugin, typeof inputPlugin, typeof spritePlugin]
  >
) {
  let previousMouseButtonState = false;
  const weaponRecoilState = new Map<string, { recoilAmount: number; recoverySpeed: number }>();

  addUpdateCallback((deltaTime: number) => {
    const mouseScreenPos = gameContext.input.getMousePosition();
    const isMousePressed = gameContext.input.isMouseButtonPressed("left");
    const mouseJustClicked = isMousePressed && !previousMouseButtonState;
    previousMouseButtonState = isMousePressed;

    const viewport = getViewport();
    const centerX = gameContext.canvas.width / 2;
    const centerY = gameContext.canvas.height / 2;
    const mouseWorldX =
      (mouseScreenPos.x - centerX) / viewport.scale + viewport.x;
    const mouseWorldY =
      (mouseScreenPos.y - centerY) / viewport.scale + viewport.y;

    let hasSpawnedProjectileThisFrame = false;

    gameContext.ecs.runQuery(
      [PositionComponentDefinition, WeaponComponentDefinition],
      (weaponEntityId, components) => {
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

        // Initialize or update recoil state
        if (!weaponRecoilState.has(weaponEntityId)) {
          weaponRecoilState.set(weaponEntityId, { recoilAmount: 0, recoverySpeed: 5 });
        }
        const recoilState = weaponRecoilState.get(weaponEntityId)!;

        // Recover from recoil
        recoilState.recoilAmount = Math.max(0, recoilState.recoilAmount - recoilState.recoverySpeed * deltaTime);

        if (distance > 0) {
          const normalizedX = dx / distance;
          const normalizedY = dy / distance;

          // Calculate base position
          const baseX = playerPosition.x + normalizedX * weapon.range;
          const baseY = playerPosition.y + normalizedY * weapon.range;

          // Apply recoil (move toward player)
          const recoilX = normalizedX * recoilState.recoilAmount;
          const recoilY = normalizedY * recoilState.recoilAmount;

          weaponPosition.x = baseX - recoilX;
          weaponPosition.y = baseY - recoilY;

          // Shoot projectile on mouse click (only once per frame)
          if (mouseJustClicked && !hasSpawnedProjectileThisFrame) {
            hasSpawnedProjectileThisFrame = true;
            // Apply recoil
            recoilState.recoilAmount = 15; // Recoil distance

            const projectileEntity = gameContext.ecs.createEntity();
            const projectileSpeed = 600;

            gameContext.ecs.addComponent(
              projectileEntity,
              PositionComponentDefinition
            );
            const projectilePos = gameContext.ecs.getComponent(
              projectileEntity,
              PositionComponentDefinition
            );
            if (projectilePos) {
              projectilePos.x = weaponPosition.x;
              projectilePos.y = weaponPosition.y;
            }

            gameContext.ecs.addComponent(
              projectileEntity,
              VelocityComponentDefinition
            );
            const projectileVel = gameContext.ecs.getComponent(
              projectileEntity,
              VelocityComponentDefinition
            );
            if (projectileVel) {
              projectileVel.x = normalizedX * projectileSpeed;
              projectileVel.y = normalizedY * projectileSpeed;
            }

            gameContext.ecs.addComponent(
              projectileEntity,
              ProjectileComponentDefinition
            );

            gameContext.ecs.addComponent(
              projectileEntity,
              SpriteComponentDefinition
            );
            const projectileSprite = gameContext.ecs.getComponent(
              projectileEntity,
              SpriteComponentDefinition
            );
            if (projectileSprite) {
              projectileSprite.width = 48;
              projectileSprite.height = 48;
              projectileSprite.color = "#ffff00";
              projectileSprite.image = "/fireball.png";
            }

            gameContext.ecs.addComponent(
              projectileEntity,
              ColliderComponentDefinition
            );
            const projectileCollider = gameContext.ecs.getComponent(
              projectileEntity,
              ColliderComponentDefinition
            );
            if (projectileCollider) {
              projectileCollider.colliderName = "circle";
              projectileCollider.resolverName = "projectileBoss";
              projectileCollider.collisionEnabled = true;
              projectileCollider.radius = 12;
            }
          }
        } else {
          // When mouse is at player position, default to right direction
          const baseX = playerPosition.x + weapon.range;
          const baseY = playerPosition.y;
          
          // Apply recoil (move toward player)
          const recoilX = recoilState.recoilAmount;
          
          weaponPosition.x = baseX - recoilX;
          weaponPosition.y = baseY;
        }
      }
    );
  });
}
