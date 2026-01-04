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

