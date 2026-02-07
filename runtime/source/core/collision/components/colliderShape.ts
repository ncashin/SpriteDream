export type ColliderShape = {
    colliderName: string;
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

