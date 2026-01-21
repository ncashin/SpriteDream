import type { Component } from "./ecs";

export type PropertyInputType = 
  | { type: "dropdown"; options: string[] }
  | { type: "file"; accept?: string; directory?: string }
  | { type: "text" }
  | { type: "number" }
  | { type: "boolean" };

export type ComponentDefinition = {
  type: string;
  defaultComponent: Component;
  displayName?: string;
  description?: string;
  propertyInputTypes?: Record<string, PropertyInputType>;
};

export const componentRegistry: Record<string, ComponentDefinition> = {};

export function defineComponent<T extends Component>(
  component: T,
  options?: {
    displayName?: string;
    description?: string;
    propertyInputTypes?: Record<string, PropertyInputType>;
  }
): T {
  const type = component.type;
  componentRegistry[type] = {
    type,
    defaultComponent: JSON.parse(JSON.stringify(component)),
    displayName: options?.displayName || type,
    description: options?.description,
    propertyInputTypes: options?.propertyInputTypes,
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
  bodyType: "static" | "kinematic";
  collisionEnabled: boolean;
  callbackName?: string;
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
    bodyType: "static",
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
    propertyInputTypes: {
      bodyType: {
        type: "dropdown",
        options: ["static", "kinematic"],
      },
      colliderName: {
        type: "dropdown",
        options: ["rectangle", "circle"],
      },
    },
  }
);

export type OnCollisionComponent = Component & {
  type: "onCollision";
  callbackName: string;
};
export const OnCollisionComponentDefinition: OnCollisionComponent = defineComponent(
  {
    type: "onCollision",
    callbackName: "",
  },
  {
    displayName: "On Collision",
    description: "Callback triggered when entity collides with another entity",
  }
);
