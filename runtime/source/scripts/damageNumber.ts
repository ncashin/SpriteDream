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

export type DamageNumberComponent = Component & {
  type: "damageNumber";
  lifetime: number;
  maxLifetime: number;
  damage: number;
};

export const DamageNumberComponentDefinition: DamageNumberComponent =
  defineComponent(
    {
      type: "damageNumber",
      lifetime: 0,
      maxLifetime: 1, // seconds
      damage: 0,
    },
    {
      displayName: "Damage Number",
      description: "Floating damage number display",
    }
  );

export function createDamageNumber(
  gameContext: RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>,
  x: number,
  y: number,
  damage: number
) {
  const entity = gameContext.ecs.createEntity();

  // Position
  gameContext.ecs.addComponent(entity, PositionComponentDefinition);
  const position = gameContext.ecs.getComponent(
    entity,
    PositionComponentDefinition
  );
  if (position) {
    position.x = x;
    position.y = y;
  }

  // Velocity (floats upward)
  gameContext.ecs.addComponent(entity, VelocityComponentDefinition);
  const velocity = gameContext.ecs.getComponent(
    entity,
    VelocityComponentDefinition
  );
  if (velocity) {
    velocity.x = (Math.random() - 0.5) * 20; // Subtle horizontal drift
    velocity.y = -60; // Float upward (slower)
  }

  // Damage number component
  gameContext.ecs.addComponent(entity, DamageNumberComponentDefinition);
  const damageNumber = gameContext.ecs.getComponent(
    entity,
    DamageNumberComponentDefinition
  );
  if (damageNumber) {
    damageNumber.damage = damage;
  }

  return entity;
}

export function initializeDamageNumber(
  gameContext: RequirePlugin<[typeof ecsPlugin, typeof spritePlugin]>
) {
  addUpdateCallback((deltaTime: number) => {
    gameContext.ecs.runQuery(
      [
        PositionComponentDefinition,
        VelocityComponentDefinition,
        DamageNumberComponentDefinition,
      ],
      (entity, components) => {
        const [position, velocity, damageNumber] = components as [
          PositionComponent,
          VelocityComponent,
          DamageNumberComponent
        ];

        // Update lifetime
        damageNumber.lifetime += deltaTime;

        // Apply gravity (slow down upward movement)
        velocity.y += 30 * deltaTime;

        // Slow down horizontal drift
        velocity.x *= 0.99;

        // Destroy when lifetime expires
        if (damageNumber.lifetime >= damageNumber.maxLifetime) {
          destroyEntity(gameContext.ecs.ecsInstance, entity);
        }
      }
    );
  });
}
