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

export type ColliderComponent = Component & {
  type: "collider";
  colliderName: string;
  resolverName: string;
  collisionEnabled: boolean;
  // Offset from entity position (in world space)
  offsetX?: number;
  offsetY?: number;
  // Rectangle collider properties
  width?: number;
  height?: number;
  angle?: number;
  // Circle collider properties
  radius?: number;
};
export const ColliderComponentDefinition: ColliderComponent = defineComponent(
  {
    type: "collider",
    colliderName: "rectangle",
    resolverName: "static",
    collisionEnabled: true,
    offsetX: 0,
    offsetY: 0,
    width: 32,
    height: 32,
    angle: 0,
  },
  {
    displayName: "Collider",
    description: "Collision detection and resolution component",
  }
);
