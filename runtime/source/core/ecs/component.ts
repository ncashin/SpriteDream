import type { Component } from "./ecs";

export type ComponentDefinition = {
  type: string;
  defaultComponent: Component;
  displayName?: string;
  description?: string;
};

export const componentRegistry: Record<string, ComponentDefinition> = {};

export function defineComponent<T extends Component>(
  component: T,
  options?: {
    displayName?: string;
    description?: string;
  }
): T {
  const type = component.type;
  componentRegistry[type] = {
    type,
    defaultComponent: JSON.parse(JSON.stringify(component)),
    displayName: options?.displayName || type,
    description: options?.description,
  };
  return component;
}

export type PositionComponent = Component & {
  type: "position";
  x: number;
  y: number;
};
export const PositionComponentDefinition: PositionComponent = defineComponent(
  {
    type: "position",
    x: 0,
    y: 0,
  },
  {
    displayName: "Position",
    description: "Entity position in 2D space",
  }
);

export type VelocityComponent = Component & {
  type: "velocity";
  x: number;
  y: number;
};
export const VelocityComponentDefinition: VelocityComponent = defineComponent(
  {
    type: "velocity",
    x: 0,
    y: 0,
  },
  {
    displayName: "Velocity",
    description: "Entity velocity in 2D space",
  }
);

