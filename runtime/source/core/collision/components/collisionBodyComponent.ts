import type { Component } from "../../ecs/ecs";
import { defineComponent } from "../../ecs/component";

export type CollisionBodyComponent = Component & {
    type: "collisionBody";
    bodyName?: string;
    bodyType: "static" | "kinematic";
    collisionEnabled: boolean;
    callbackName?: string;
    propagateCollision?: boolean; // If true, propagate collisions to parent entities
};

export const CollisionBodyComponentDefinition: CollisionBodyComponent = defineComponent(
    {
        type: "collisionBody",
        bodyType: "static",
        collisionEnabled: true,
        propagateCollision: false,
    },
    {
        displayName: "Collision Body",
        description: "Collision body settings (type, callbacks, propagation)",
        propertyInputTypes: {
            bodyType: {
                type: "dropdown",
                options: ["static", "kinematic"],
            },
            collisionEnabled: {
                type: "boolean",
            },
            propagateCollision: {
                type: "boolean",
            },
        },
    }
);

