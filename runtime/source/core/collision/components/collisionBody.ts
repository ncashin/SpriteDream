export type CollisionBody = {
    bodyName?: string;
    bodyType: "static" | "kinematic";
    collisionEnabled: boolean;
    callbackName?: string;
    propagateCollision?: boolean; // If true, propagate collisions to parent entities
};

