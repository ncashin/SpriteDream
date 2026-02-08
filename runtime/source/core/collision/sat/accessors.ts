import type { Vector } from "../../vector";
import { create, sub } from "../../vector";
import type { ECSInstance, Entity } from "../../ecs/ecs";
import { getEntity } from "../../ecs/ecs";
import { VelocityComponentDefinition } from "../../ecs/component";
import {
    ColliderComponentDefinition,
    type ColliderComponent,
} from "../components/colliderComponent";
import {
    CollisionBodyComponentDefinition,
    type CollisionBodyComponent,
} from "../components/collisionBodyComponent";
import type { ColliderShape } from "../components/colliderShape";
import {
    getWorldPosition,
    getWorldTransform,
} from "../../transform";

export const getEntityPosition = (
    ecs: ECSInstance,
    entity: Entity
): Vector | null => {
    const worldPos = getWorldPosition(ecs, entity);
    if (!worldPos) return null;
    return create(worldPos.x, worldPos.y);
};

export const getEntityVelocity = (
    ecs: ECSInstance,
    entity: Entity
): Vector | null => {
    const velocity = getEntity(ecs, entity)[VelocityComponentDefinition.type] as
        | typeof VelocityComponentDefinition
        | undefined;
    if (!velocity) return null;
    return create(velocity.x, velocity.y);
};

export type CollisionColliderEntry = {
    body: CollisionBodyComponent;
    collider: ColliderShape;
};

const colliderOverrideByEntity = new Map<Entity, ColliderComponent>();
const bodyOverrideByEntity = new Map<Entity, CollisionBodyComponent>();

export const withCollisionOverrides = <T>(
    overrides: { entity: Entity; collider?: ColliderComponent; body?: CollisionBodyComponent }[],
    fn: () => T
): T => {
    for (const override of overrides) {
        if (override.collider) {
            colliderOverrideByEntity.set(override.entity, override.collider);
        }
        if (override.body) {
            bodyOverrideByEntity.set(override.entity, override.body);
        }
    }
    try {
        return fn();
    } finally {
        for (const override of overrides) {
            if (override.collider) {
                colliderOverrideByEntity.delete(override.entity);
            }
            if (override.body) {
                bodyOverrideByEntity.delete(override.entity);
            }
        }
    }
};

export const withColliderOverrides = <T>(
    overrides: { entity: Entity; collider: ColliderComponent }[],
    fn: () => T
): T => withCollisionOverrides(overrides, fn);

export const getEntityCollider = (
    ecs: ECSInstance,
    entity: Entity
): ColliderComponent | null => {
    const override = colliderOverrideByEntity.get(entity);
    if (override) return override;
    return (
        getEntity(ecs, entity)[ColliderComponentDefinition.type] as
        | ColliderComponent
        | undefined
    ) ?? null;
};

export const getEntityCollisionBody = (
    ecs: ECSInstance,
    entity: Entity
): CollisionBodyComponent | null => {
    const override = bodyOverrideByEntity.get(entity);
    if (override) return override;
    return (
        getEntity(ecs, entity)[CollisionBodyComponentDefinition.type] as
        | CollisionBodyComponent
        | undefined
    ) ?? null;
};

const normalizeColliderShape = (
    shape?: Partial<ColliderShape>
): ColliderShape => ({
    colliderName: shape?.colliderName ?? "rectangle",
    width: shape?.width,
    height: shape?.height,
    angle: shape?.angle,
    radius: shape?.radius,
    offsetX: shape?.offsetX,
    offsetY: shape?.offsetY,
});

export const getEntityCollisionBodies = (
    ecs: ECSInstance,
    entity: Entity
): CollisionBodyComponent[] => {
    const body = getEntityCollisionBody(ecs, entity);
    if (body) return [body];
    return [];
};

export const getEntityCollisionColliders = (
    ecs: ECSInstance,
    entity: Entity
): CollisionColliderEntry[] => {
    const bodies = getEntityCollisionBodies(ecs, entity);
    const colliders: CollisionColliderEntry[] = [];
    const collider = getEntityCollider(ecs, entity);
    if (!collider) return colliders;
    const shape = normalizeColliderShape(collider);
    for (const body of bodies) {
        colliders.push({ body, collider: shape });
    }
    return colliders;
};

export const buildColliderOverride = (
    _body: CollisionBodyComponent,
    collider: ColliderShape
): ColliderComponent => ({
    type: "collider",
    colliderName: collider.colliderName ?? "rectangle",
    width: collider.width,
    height: collider.height,
    angle: collider.angle,
    radius: collider.radius,
    offsetX: collider.offsetX,
    offsetY: collider.offsetY,
});

export const buildBodyOverride = (body: CollisionBodyComponent): CollisionBodyComponent => ({
    type: "collisionBody",
    bodyName: body.bodyName,
    bodyType: body.bodyType ?? "static",
    collisionEnabled: body.collisionEnabled ?? true,
    collisionCallback: body.collisionCallback,
    propagateCollision: body.propagateCollision ?? false,
    collisionLayer: body.collisionLayer ?? 1,
    collisionMask: body.collisionMask ?? 0xffffffff,
});

export const getCollisionPosition = (
    ecs: ECSInstance,
    entity: Entity
): Vector | null => {
    const collider = getEntityCollider(ecs, entity);
    return getColliderWorldPosition(ecs, entity, collider);
};

export const getColliderWorldPosition = (
    ecs: ECSInstance,
    entity: Entity,
    collider?: Pick<ColliderShape, "offsetX" | "offsetY"> | null
): Vector | null => {
    const worldPos = getWorldPosition(ecs, entity);
    if (!worldPos) return null;

    const offsetX = collider?.offsetX ?? 0;
    const offsetY = collider?.offsetY ?? 0;
    if (offsetX === 0 && offsetY === 0) {
        return create(worldPos.x, worldPos.y);
    }

    const worldTransform = getWorldTransform(ecs, entity);
    const scaleX = worldTransform?.scaleX ?? 1;
    const scaleY = worldTransform?.scaleY ?? 1;
    const rotationRad = ((worldTransform?.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);

    const scaledOffsetX = offsetX * scaleX;
    const scaledOffsetY = offsetY * scaleY;
    const rotatedOffsetX = scaledOffsetX * cos - scaledOffsetY * sin;
    const rotatedOffsetY = scaledOffsetX * sin + scaledOffsetY * cos;

    return create(worldPos.x + rotatedOffsetX, worldPos.y + rotatedOffsetY);
};

export const getRectangleTopLeft = (
    ecs: ECSInstance,
    entity: Entity
): Vector | null => {
    const center = getCollisionPosition(ecs, entity);
    const collider = getEntityCollider(ecs, entity);
    if (!center || !collider) return null;

    const width = collider.width ?? 32;
    const height = collider.height ?? 32;
    const halfSize = create(width / 2, height / 2);
    return sub(center, halfSize);
};

