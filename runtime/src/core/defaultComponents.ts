import type { Component } from "./ecs/ecs";

export type PositionComponent = Component & {
  type: "position";
  x: number;
  y: number;
};

export type VelocityComponent = Component & {
  type: "velocity";
  x: number;
  y: number;
};

export type SpriteComponent = Component & {
  type: "sprite";
  width: number;
  height: number;
  color: string;
};

export const PositionComponentDefinition: PositionComponent = {
  type: "position",
  x: 0,
  y: 0,
} as const;

export const VelocityComponentDefinition: VelocityComponent = {
  type: "velocity",
  x: 0,
  y: 0,
} as const;

export const SpriteComponentDefinition: SpriteComponent = {
  type: "sprite",
  width: 32,
  height: 32,
  color: "#ffffff",
} as const;

