import type { Component } from "./ecs";

export type PropertyInputType =
  | { type: "dropdown"; options: string[] | (() => string[]) }
  | { type: "bitmask"; options: string[] | (() => string[]) }
  | { type: "file"; accept?: string; directory?: string }
  | { type: "color" }
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

  const cloned = JSON.parse(JSON.stringify(component));

  if (type === 'transform' && cloned && typeof cloned === 'object') {
    if (!('parent' in cloned) || cloned.parent === undefined) {
      cloned.parent = null;
    }
  }
  componentRegistry[type] = {
    type,
    defaultComponent: cloned,
    displayName: options?.displayName || type,
    description: options?.description,
    propertyInputTypes: options?.propertyInputTypes,
  };
  return component;
}

export type TransformComponent = Component & {
  type: "transform";
  parent?: string; // Entity ID of parent (for scene graph)
  x: number;
  y: number;
  rotation: number; // in degrees
  scaleX: number;
  scaleY: number;
};
export const TransformComponentDefinition: TransformComponent = defineComponent(
  {
    type: "transform",
    parent: undefined,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  },
  {
    displayName: "Transform",
    description: "Entity transform (position, rotation, scale) in local space (relative to parent if one exists)",
    propertyInputTypes: {
      rotation: {
        type: "number",
      },
      scaleX: {
        type: "number",
      },
      scaleY: {
        type: "number",
      },
    },
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

