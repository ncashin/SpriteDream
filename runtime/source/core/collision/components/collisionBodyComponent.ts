import type { Component } from "../../ecs/ecs";
import { defineComponent } from "../../ecs/component";

export type CollisionBodyComponent = Component & {
    type: "collisionBody";
    bodyName?: string;
    bodyType: "static" | "kinematic";
    collisionEnabled: boolean;
    callbackName?: string;
    propagateCollision?: boolean;
    collisionLayer?: number;
    collisionMask?: number;
};

export const CollisionBodyComponentDefinition: CollisionBodyComponent = defineComponent(
    {
        type: "collisionBody",
        bodyType: "static",
        collisionEnabled: true,
        propagateCollision: false,
        collisionLayer: 1,
        collisionMask: 0xffffffff,
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
            collisionLayer: {
                type: "number",
            },
            collisionMask: {
                type: "number",
            },
        },
    }
);

