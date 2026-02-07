import type { ColliderDefinition } from "./types";

export const colliders: { [name: string]: ColliderDefinition } = {};

export const registerCollider = (collider: ColliderDefinition) => {
    colliders[collider.name] = collider;
};

export const unregisterCollider = (name: string) => {
    delete colliders[name];
};

