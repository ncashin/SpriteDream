import { defineComponent, type PositionComponent } from "../core/ecs/component";
import type { Component } from "../core/ecs/ecs";

export type HealthComponent = Component & {
  type: "health";
  currentHealth: number;
  maxHealth: number;
};

export const HealthComponentDefinition: HealthComponent = defineComponent(
  {
    type: "health",
    currentHealth: 100,
    maxHealth: 100,
  },
  {
    displayName: "Health",
    description: "Entity health and damage tracking",
  }
);

export function damageEntity(
  entity: Record<string, Component>,
  amount: number
): boolean {
  const health = entity.health as HealthComponent | undefined;
  if (!health) return false;

  health.currentHealth = Math.max(0, health.currentHealth - amount);
  return health.currentHealth <= 0; // Returns true if entity is dead
}

