import type { Component } from "../../ecs/ecs";
import { defineComponent } from "../../ecs/component";

export type ColliderComponent = Component & {
    type: "collider";
    colliderName?: string;
    // Rectangle collider properties
    width?: number;
    height?: number;
    angle?: number;
    // Circle collider properties
    radius?: number;
    // Local offset from the entity's origin
    offsetX?: number;
    offsetY?: number;
};

export const ColliderComponentDefinition: ColliderComponent = defineComponent(
    {
        type: "collider",
        colliderName: "rectangle",
        width: 32,
        height: 32,
        angle: 0,
    },
    {
        displayName: "Collider",
        description: "Collision shape for an entity",
        propertyInputTypes: {
            colliderName: {
                type: "dropdown",
                options: ["rectangle", "circle"],
            },
        },
    }
);

