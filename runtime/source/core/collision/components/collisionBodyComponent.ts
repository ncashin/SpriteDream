import type { Component } from "../../ecs/ecs";
import { defineComponent } from "../../ecs/component";
import { collisionCallbackRegistry } from "../collisionCallbacks";
import { getCollisionLayerOptions } from "../collisionLayers";

const getCollisionCallbackOptions = () =>
    Object.keys(collisionCallbackRegistry).sort();

const getCollisionMaskOptions = () => getCollisionLayerOptions();

export type CollisionBodyComponent = Component & {
    type: "collisionBody";
    bodyName?: string;
    bodyType: "static" | "kinematic" | "trigger";
    collisionEnabled: boolean;
    collisionCallback?: string | null;
    propagateCollision?: boolean;
    collisionLayer?: number;
    collideWith?: number;
};

export const CollisionBodyComponentDefinition: CollisionBodyComponent = defineComponent(
    {
        type: "collisionBody",
        bodyType: "static",
        collisionEnabled: true,
        collisionCallback: null,
        propagateCollision: false,
        collisionLayer: 1,
        collideWith: 0xffffffff,
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
                type: "bitmask",
                options: getCollisionLayerOptions,
            },
            collideWith: {
                type: "bitmask",
                options: getCollisionMaskOptions,
            },
        },
    }
);

