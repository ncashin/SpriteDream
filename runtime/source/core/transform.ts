import type { ECSInstance, Entity } from "./ecs/ecs";
import { getComponent, addComponent } from "./ecs/ecs";
import {
    TransformComponentDefinition,
    type TransformComponent,
    PositionComponentDefinition,
} from "./ecs/component";

export type Transform = {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
};

export function getTransform(
    ecs: ECSInstance,
    entity: Entity
): Transform | null {
    const transform = getComponent(ecs, entity, TransformComponentDefinition);
    if (transform) {
        return {
            x: transform.x,
            y: transform.y,
            rotation: transform.rotation ?? 0,
            scaleX: transform.scaleX ?? 1,
            scaleY: transform.scaleY ?? 1,
        };
    }

    const position = getComponent(ecs, entity, PositionComponentDefinition);
    if (position) {
        return {
            x: position.x,
            y: position.y,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
        };
    }

    return null;
}

export function getWorldTransform(
    ecs: ECSInstance,
    entity: Entity
): Transform | null {
    const localTransform = getTransform(ecs, entity);
    if (!localTransform) return null;

    const transform = getComponent(ecs, entity, TransformComponentDefinition);
    const parentId = transform?.parent;

    if (!parentId) {
        return localTransform;
    }

    const parentWorldTransform = getWorldTransform(ecs, parentId);
    if (!parentWorldTransform) {
        return localTransform;
    }

    const parentRotationRad = (parentWorldTransform.rotation * Math.PI) / 180;
    const cos = Math.cos(parentRotationRad);
    const sin = Math.sin(parentRotationRad);

    const scaledX = localTransform.x * parentWorldTransform.scaleX;
    const scaledY = localTransform.y * parentWorldTransform.scaleY;

    const worldX = parentWorldTransform.x + scaledX * cos - scaledY * sin;
    const worldY = parentWorldTransform.y + scaledX * sin + scaledY * cos;

    return {
        x: worldX,
        y: worldY,
        rotation: parentWorldTransform.rotation + localTransform.rotation,
        scaleX: parentWorldTransform.scaleX * localTransform.scaleX,
        scaleY: parentWorldTransform.scaleY * localTransform.scaleY,
    };
}

export function getWorldPosition(
    ecs: ECSInstance,
    entity: Entity
): { x: number; y: number } | null {
    const worldTransform = getWorldTransform(ecs, entity);
    if (!worldTransform) return null;
    return { x: worldTransform.x, y: worldTransform.y };
}

export function getWorldRotation(ecs: ECSInstance, entity: Entity): number {
    const worldTransform = getWorldTransform(ecs, entity);
    if (!worldTransform) return 0;
    return worldTransform.rotation;
}

export function getWorldScale(
    ecs: ECSInstance,
    entity: Entity
): { scaleX: number; scaleY: number } | null {
    const worldTransform = getWorldTransform(ecs, entity);
    if (!worldTransform) return null;
    return { scaleX: worldTransform.scaleX, scaleY: worldTransform.scaleY };
}

export function setTransform(
    ecs: ECSInstance,
    entity: Entity,
    transform: Partial<Transform & { parent?: string }>
): void {
    const existing = getComponent(ecs, entity, TransformComponentDefinition);
    if (existing) {
        // Set each property individually to ensure proxy handlers are triggered
        // and changes are properly persisted to the scene
        if (transform.x !== undefined) existing.x = transform.x;
        if (transform.y !== undefined) existing.y = transform.y;
        if (transform.rotation !== undefined) existing.rotation = transform.rotation;
        if (transform.scaleX !== undefined) existing.scaleX = transform.scaleX;
        if (transform.scaleY !== undefined) existing.scaleY = transform.scaleY;
        if ('parent' in transform) {
            if (transform.parent !== undefined) {
                existing.parent = transform.parent;
            } else {
                delete existing.parent;
            }
        }
    } else {
        addComponent(ecs, entity, {
            type: "transform",
            x: transform.x ?? 0,
            y: transform.y ?? 0,
            rotation: transform.rotation ?? 0,
            scaleX: transform.scaleX ?? 1,
            scaleY: transform.scaleY ?? 1,
            parent: transform.parent,
        } as TransformComponent);
    }
}

export function setWorldPosition(
    ecs: ECSInstance,
    entity: Entity,
    worldX: number,
    worldY: number
): void {
    const transform = getComponent(ecs, entity, TransformComponentDefinition);
    const parentId = transform?.parent;

    if (!parentId) {
        setTransform(ecs, entity, { x: worldX, y: worldY });
        return;
    }

    const parentWorldTransform = getWorldTransform(ecs, parentId);
    if (!parentWorldTransform) {
        console.warn(`Cannot set world position: parent entity "${parentId}" has no transform`);
        return;
    }

    if (parentWorldTransform.scaleX === 0 || parentWorldTransform.scaleY === 0) {
        console.warn("Cannot set world position: parent has zero scale");
        return;
    }

    const relativeX = worldX - parentWorldTransform.x;
    const relativeY = worldY - parentWorldTransform.y;

    const parentRotationRad = (parentWorldTransform.rotation * Math.PI) / 180;
    const cos = Math.cos(parentRotationRad);
    const sin = Math.sin(parentRotationRad);

    const rotatedX = relativeX * cos + relativeY * sin;
    const rotatedY = -relativeX * sin + relativeY * cos;

    const localX = rotatedX / parentWorldTransform.scaleX;
    const localY = rotatedY / parentWorldTransform.scaleY;

    setTransform(ecs, entity, { x: localX, y: localY });
}

export function setWorldTransform(
    ecs: ECSInstance,
    entity: Entity,
    worldTransform: Transform,
    overrideParent?: Entity | null
): void {
    const transform = getComponent(ecs, entity, TransformComponentDefinition);
    // Use overrideParent if provided, otherwise read from component
    const parentId = overrideParent !== undefined ? overrideParent : transform?.parent;

    if (!parentId) {
        setTransform(ecs, entity, worldTransform);
        return;
    }

    const parentWorldTransform = getWorldTransform(ecs, parentId);
    if (!parentWorldTransform) {
        console.warn(`Cannot set world transform: parent entity "${parentId}" has no transform`);
        return;
    }

    if (parentWorldTransform.scaleX === 0 || parentWorldTransform.scaleY === 0) {
        console.warn("Cannot set world transform: parent has zero scale");
        return;
    }

    const relativeX = worldTransform.x - parentWorldTransform.x;
    const relativeY = worldTransform.y - parentWorldTransform.y;

    const parentRotationRad = (parentWorldTransform.rotation * Math.PI) / 180;
    const cos = Math.cos(parentRotationRad);
    const sin = Math.sin(parentRotationRad);

    const rotatedX = relativeX * cos + relativeY * sin;
    const rotatedY = -relativeX * sin + relativeY * cos;

    const localX = rotatedX / parentWorldTransform.scaleX;
    const localY = rotatedY / parentWorldTransform.scaleY;
    const localRotation = worldTransform.rotation - parentWorldTransform.rotation;
    const localScaleX = worldTransform.scaleX / parentWorldTransform.scaleX;
    const localScaleY = worldTransform.scaleY / parentWorldTransform.scaleY;

    // Explicitly preserve the parent when updating the transform
    const updateData: Partial<Transform & { parent?: string }> = {
        x: localX,
        y: localY,
        rotation: localRotation,
        scaleX: localScaleX,
        scaleY: localScaleY,
    };
    // Only include parent if it exists (don't set to undefined)
    if (parentId) {
        updateData.parent = parentId;
    }
    setTransform(ecs, entity, updateData);
}

export function setParent(
    ecs: ECSInstance,
    entity: Entity,
    parentId: Entity | null
): void {
    // Get the child's world transform before changing parent
    // This preserves the entity's position, rotation, and scale in world space
    let childWorldTransform = getWorldTransform(ecs, entity);
    if (!childWorldTransform) {
        setTransform(ecs, entity, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        childWorldTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    }

    // Validate that the new parent exists (if not null)
    if (parentId) {
        const parentTransform = getComponent(ecs, parentId, TransformComponentDefinition);
        if (!parentTransform) {
            console.warn(`Cannot reparent: parent entity "${parentId}" has no transform component`);
            return;
        }
    }

    // Calculate the new local transform using the NEW parent BEFORE updating the component
    // This ensures we use the correct parent for the calculation
    let newLocalTransform: Partial<Transform & { parent?: string }>;

    if (!parentId) {
        // No parent - world transform equals local transform
        newLocalTransform = childWorldTransform;
    } else {
        // Get the new parent's world transform
        const parentWorldTransform = getWorldTransform(ecs, parentId);
        if (!parentWorldTransform) {
            console.warn(`Cannot reparent: parent entity "${parentId}" has no world transform`);
            return;
        }

        if (parentWorldTransform.scaleX === 0 || parentWorldTransform.scaleY === 0) {
            console.warn("Cannot reparent: parent has zero scale");
            return;
        }

        // Calculate relative position
        const relativeX = childWorldTransform.x - parentWorldTransform.x;
        const relativeY = childWorldTransform.y - parentWorldTransform.y;

        // Rotate relative position by inverse of parent rotation
        const parentRotationRad = (parentWorldTransform.rotation * Math.PI) / 180;
        const cos = Math.cos(parentRotationRad);
        const sin = Math.sin(parentRotationRad);

        const rotatedX = relativeX * cos + relativeY * sin;
        const rotatedY = -relativeX * sin + relativeY * cos;

        // Scale by inverse of parent scale
        const localX = rotatedX / parentWorldTransform.scaleX;
        const localY = rotatedY / parentWorldTransform.scaleY;
        const localRotation = childWorldTransform.rotation - parentWorldTransform.rotation;
        const localScaleX = childWorldTransform.scaleX / parentWorldTransform.scaleX;
        const localScaleY = childWorldTransform.scaleY / parentWorldTransform.scaleY;

        newLocalTransform = {
            x: localX,
            y: localY,
            rotation: localRotation,
            scaleX: localScaleX,
            scaleY: localScaleY,
        };
    }

    // Now update the transform component with the new local values AND the new parent
    setTransform(ecs, entity, {
        ...newLocalTransform,
        parent: parentId ?? undefined,
    });
}

export function getChildren(
    ecs: ECSInstance,
    entity: Entity
): Entity[] {
    const children: Entity[] = [];
    for (const [childId, components] of Object.entries(ecs.entities)) {
        const transform = components.transform as TransformComponent | undefined;
        if (transform?.parent === entity) {
            children.push(childId);
        }
    }
    return children;
}

