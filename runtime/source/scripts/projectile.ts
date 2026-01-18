import { addUpdateCallback } from "../core/gameloop";
import {
  PositionComponentDefinition,
  VelocityComponentDefinition,
  defineComponent,
  type PositionComponent,
  type VelocityComponent,
} from "../core/ecs/component";
import type { Component } from "../core/ecs/ecs";
import type { RequirePlugin } from "../core/gameContext";
import { ecsPlugin } from "../core/scene/ecsAdapter";
import { spritePlugin } from "../core/sprite";
import { destroyEntity } from "../core/ecs/ecs";

export type ProjectileComponent = Component & {
  type: "projectile";
  speed: number;
  lifetime: number;
  maxLifetime: number;
};

export const ProjectileComponentDefinition: ProjectileComponent =
  defineComponent(
    {
      type: "projectile",
      speed: 500,
      lifetime: 0,
      maxLifetime: 5, // seconds
    },
    {
      displayName: "Projectile",
      description: "A projectile that moves in a direction",
    }
  );

export function initializeProjectile(
  gameContext: RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
) {
  addUpdateCallback((deltaTime: number) => {
    gameContext.ecs.runQuery(
      [
        PositionComponentDefinition,
        VelocityComponentDefinition,
        ProjectileComponentDefinition,
      ],
      (entity, components) => {
        const [, , projectile] = components as [
          PositionComponent,
          VelocityComponent,
          ProjectileComponent
        ];

        // Update lifetime
        projectile.lifetime += deltaTime;

        // Destroy projectile if it exceeds max lifetime
        if (projectile.lifetime >= projectile.maxLifetime) {
          destroyEntity(gameContext.ecs.ecsInstance, entity);
        }
      }
    );
  });
}
