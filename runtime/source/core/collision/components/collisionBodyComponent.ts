import type { Component } from "../../ecs/ecs";
import { defineComponent } from "../../ecs/component";
import { collisionCallbackRegistry } from "../collisionCallbacks";

const getCollisionCallbackOptions = () =>
    Object.keys(collisionCallbackRegistry).sort();

export type CollisionBodyComponent = Component & {
    type: "collisionBody";
    bodyName?: string;
    bodyType: "static" | "kinematic" | "trigger";
    collisionEnabled: boolean;
    collisionCallback?: string;
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
                options: ["static", "kinematic", "trigger"],
            },
            collisionCallback: {
                type: "dropdown",
                options: getCollisionCallbackOptions,
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

