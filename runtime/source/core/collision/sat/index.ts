import type { Vector } from "../../vector";
import { create, dot, normalize, scale } from "../../vector";
import type { ECSInstance, Entity } from "../../ecs/ecs";
import { getEntity } from "../../ecs/ecs";
import { TransformComponentDefinition } from "../../ecs/component";
import { getCollisionCallback } from "../collisionCallbacks";
import {
    getParents,
    moveEntityAndParents,
    getTransform,
    getWorldTransform,
    setTransform,
    worldDirectionToLocal,
    worldDistanceToLocal,
} from "../../transform";
import { colliders, registerCollider, unregisterCollider } from "./registry";
import { RECTANGLE_COLLIDER } from "./colliders/rectangleCollider";
import { CIRCLE_COLLIDER } from "./colliders/circleCollider";
import {
    buildBodyOverride,
    buildColliderOverride,
    getCollisionPosition,
    getEntityCollisionBody,
    getEntityCollisionColliders,
    getEntityCollider,
    withCollisionOverrides,
} from "./accessors";

export * from "./accessors";
export * from "./registry";
export * from "./types";

export type CollisionResolver = (
    ecs: ECSInstance,
    entity: Entity,
    other: Entity,
    overlapAmount: number,
    overlapNormal: Vector
) => void;

let customResolver: CollisionResolver | null = null;

export const setCollisionResolver = (resolver: CollisionResolver) => {
    customResolver = resolver;
};

export const getCollisionResolver = (): CollisionResolver | null => {
    return customResolver;
};

const shouldCollideWithMasks = (
    bodyA: { collisionLayer?: number; collisionMask?: number },
    bodyB: { collisionLayer?: number; collisionMask?: number }
): boolean => {
    const layerA = (bodyA.collisionLayer ?? 1) >>> 0;
    const maskA = (bodyA.collisionMask ?? 0xffffffff) >>> 0;
    const layerB = (bodyB.collisionLayer ?? 1) >>> 0;
    const maskB = (bodyB.collisionMask ?? 0xffffffff) >>> 0;
    return (maskA & layerB) !== 0 && (maskB & layerA) !== 0;
};

export const handleCollisionPair = (
    ecs: ECSInstance,
    entityA: Entity,
    entityB: Entity
) => {
    if (entityA === entityB) return;

    const collidersA = getEntityCollisionColliders(ecs, entityA);
    const collidersB = getEntityCollisionColliders(ecs, entityB);

    if (collidersA.length === 0 || collidersB.length === 0) return;

    for (const colliderA of collidersA) {
        if (!colliderA.body.collisionEnabled) continue;
        for (const colliderB of collidersB) {
            if (!colliderB.body.collisionEnabled) continue;
            if (!shouldCollideWithMasks(colliderA.body, colliderB.body)) continue;
            const overrideA = buildColliderOverride(colliderA.body, colliderA.collider);
            const overrideB = buildColliderOverride(colliderB.body, colliderB.collider);
            const bodyOverrideA = buildBodyOverride(colliderA.body);
            const bodyOverrideB = buildBodyOverride(colliderB.body);
            withCollisionOverrides(
                [
                    { entity: entityA, collider: overrideA, body: bodyOverrideA },
                    { entity: entityB, collider: overrideB, body: bodyOverrideB },
                ],
                () => handleCollisionPairSingle(ecs, entityA, entityB)
            );
        }
    }
};

const handleCollisionPairSingle = (
    ecs: ECSInstance,
    entityA: Entity,
    entityB: Entity
) => {
    if (entityA === entityB) return;

    const colliderA = getEntityCollider(ecs, entityA);
    const colliderB = getEntityCollider(ecs, entityB);
    const bodyA = getEntityCollisionBody(ecs, entityA);
    const bodyB = getEntityCollisionBody(ecs, entityB);

    if (!colliderA || !colliderB || !bodyA || !bodyB) return;
    if (!bodyA.collisionEnabled || !bodyB.collisionEnabled) return;
    if (!shouldCollideWithMasks(bodyA, bodyB)) return;

    const colliderNameA = colliderA.colliderName ?? "rectangle";
    const colliderNameB = colliderB.colliderName ?? "rectangle";
    const colliderDefA = colliders[colliderNameA];
    const colliderDefB = colliders[colliderNameB];

    if (!colliderDefA || !colliderDefB) {
        console.warn(
            `Missing collider for entity: ${colliderNameA} or ${colliderNameB}`
        );
        return;
    }

    const resolver = customResolver || defaultCollisionResolver;

    const normals = [
        ...colliderDefA.getNormals(ecs, entityA, entityB),
        ...colliderDefB.getNormals(ecs, entityB, entityA),
    ];

    let minOverlap = Infinity;
    let smallestNormal: Vector | null = null;

    for (const normal of normals) {
        const n = normalize(normal);

        const projA = colliderDefA.calculateProjection(ecs, entityA, n);
        const projB = colliderDefB.calculateProjection(ecs, entityB, n);


        const overlapA = projB.max - projA.min;
        const overlapB = projA.max - projB.min;


        if (overlapA <= 0 || overlapB <= 0) {

            minOverlap = 0;
            smallestNormal = null;
            break;
        }



        let currentOverlap: number;
        let currentNormal: Vector;

        if (overlapA < overlapB) {

            currentOverlap = overlapA;
            currentNormal = n;
        } else {

            currentOverlap = overlapB;
            currentNormal = scale(n, -1);
        }

        if (currentOverlap < minOverlap) {
            minOverlap = currentOverlap;
            smallestNormal = currentNormal;
        }
    }

    if (smallestNormal && minOverlap > 0 && minOverlap < Infinity) {


        resolver(
            ecs,
            entityA,
            entityB,
            minOverlap,
            smallestNormal
        );





        if (bodyA.collisionCallback) {
            const callbackDef = getCollisionCallback(bodyA.collisionCallback);
            if (callbackDef) {

                let localNormalA = worldDirectionToLocal(ecs, entityA, smallestNormal[0], smallestNormal[1]);
                const localTransformA = getTransform(ecs, entityA);
                if (localTransformA) {
                    const localRotation = localTransformA.rotation ?? 0;
                    const rotationRad = (localRotation * Math.PI) / 180;
                    const cos = Math.cos(rotationRad);
                    const sin = Math.sin(rotationRad);
                    const rotatedNormalX = localNormalA.x * cos - localNormalA.y * sin;
                    const rotatedNormalY = localNormalA.x * sin + localNormalA.y * cos;
                    localNormalA = { x: rotatedNormalX, y: rotatedNormalY };
                }
                const localNormalVector = create(localNormalA.x, localNormalA.y);
                callbackDef.callback({
                    ecs,
                    entityId: entityA,
                    entity: getEntity(ecs, entityA),
                    otherId: entityB,
                    other: getEntity(ecs, entityB),
                    overlapAmount: minOverlap,
                    overlapNormal: localNormalVector,
                });
            }
        }


        if (bodyA.propagateCollision) {
            const parentsA = getParents(ecs, entityA);
            for (const parentA of parentsA) {
                const parentBody = getEntityCollisionBody(ecs, parentA);
                if (parentBody?.collisionCallback) {
                    const parentCallbackDef = getCollisionCallback(parentBody.collisionCallback);
                    if (parentCallbackDef) {

                        let localNormalParentA = worldDirectionToLocal(ecs, parentA, smallestNormal[0], smallestNormal[1]);
                        const localTransformParentA = getTransform(ecs, parentA);
                        if (localTransformParentA) {
                            const localRotation = localTransformParentA.rotation ?? 0;
                            const rotationRad = (localRotation * Math.PI) / 180;
                            const cos = Math.cos(rotationRad);
                            const sin = Math.sin(rotationRad);
                            const rotatedNormalX = localNormalParentA.x * cos - localNormalParentA.y * sin;
                            const rotatedNormalY = localNormalParentA.x * sin + localNormalParentA.y * cos;
                            localNormalParentA = { x: rotatedNormalX, y: rotatedNormalY };
                        }
                        const localNormalVectorParentA = create(localNormalParentA.x, localNormalParentA.y);
                        parentCallbackDef.callback({
                            ecs,
                            entityId: parentA,
                            entity: getEntity(ecs, parentA),
                            otherId: entityB,
                            other: getEntity(ecs, entityB),
                            overlapAmount: minOverlap,
                            overlapNormal: localNormalVectorParentA,
                        });
                    }
                }
            }
        }

        if (bodyB.collisionCallback) {
            const callbackDef = getCollisionCallback(bodyB.collisionCallback);
            if (callbackDef) {
                const reversedNormal = scale(smallestNormal, -1);

                let localNormalB = worldDirectionToLocal(ecs, entityB, reversedNormal[0], reversedNormal[1]);
                const localTransformB = getTransform(ecs, entityB);
                if (localTransformB) {
                    const localRotation = localTransformB.rotation ?? 0;
                    const rotationRad = (localRotation * Math.PI) / 180;
                    const cos = Math.cos(rotationRad);
                    const sin = Math.sin(rotationRad);
                    const rotatedNormalX = localNormalB.x * cos - localNormalB.y * sin;
                    const rotatedNormalY = localNormalB.x * sin + localNormalB.y * cos;
                    localNormalB = { x: rotatedNormalX, y: rotatedNormalY };
                }
                const localNormalVectorB = create(localNormalB.x, localNormalB.y);
                callbackDef.callback({
                    ecs,
                    entityId: entityB,
                    entity: getEntity(ecs, entityB),
                    otherId: entityA,
                    other: getEntity(ecs, entityA),
                    overlapAmount: minOverlap,
                    overlapNormal: localNormalVectorB,
                });
            }
        }


        if (bodyB.propagateCollision) {
            const parentsB = getParents(ecs, entityB);
            for (const parentB of parentsB) {
                const parentBody = getEntityCollisionBody(ecs, parentB);
                if (parentBody?.collisionCallback) {
                    const parentCallbackDef = getCollisionCallback(parentBody.collisionCallback);
                    if (parentCallbackDef) {
                        const reversedNormal = scale(smallestNormal, -1);

                        let localNormalParentB = worldDirectionToLocal(ecs, parentB, reversedNormal[0], reversedNormal[1]);
                        const localTransformParentB = getTransform(ecs, parentB);
                        if (localTransformParentB) {
                            const localRotation = localTransformParentB.rotation ?? 0;
                            const rotationRad = (localRotation * Math.PI) / 180;
                            const cos = Math.cos(rotationRad);
                            const sin = Math.sin(rotationRad);
                            const rotatedNormalX = localNormalParentB.x * cos - localNormalParentB.y * sin;
                            const rotatedNormalY = localNormalParentB.x * sin + localNormalParentB.y * cos;
                            localNormalParentB = { x: rotatedNormalX, y: rotatedNormalY };
                        }
                        const localNormalVectorParentB = create(localNormalParentB.x, localNormalParentB.y);
                        parentCallbackDef.callback({
                            ecs,
                            entityId: parentB,
                            entity: getEntity(ecs, parentB),
                            otherId: entityA,
                            other: getEntity(ecs, entityA),
                            overlapAmount: minOverlap,
                            overlapNormal: localNormalVectorParentB,
                        });
                    }
                }
            }
        }
    }
};

const defaultCollisionResolver: CollisionResolver = (
    ecs,
    entityA,
    entityB,
    overlapAmount,
    overlapNormal
) => {
    if (entityA === entityB) {
        return;
    }

    const bodyA = getEntityCollisionBody(ecs, entityA);
    const bodyB = getEntityCollisionBody(ecs, entityB);

    if (!bodyA || !bodyB) return;
    if (bodyA.bodyType === "trigger" || bodyB.bodyType === "trigger") {
        return;
    }

    const transformA = getEntity(ecs, entityA)[TransformComponentDefinition.type] as typeof TransformComponentDefinition | undefined;
    const transformB = getEntity(ecs, entityB)[TransformComponentDefinition.type] as typeof TransformComponentDefinition | undefined;

    if (!transformA || !transformB) return;



    const n = normalize(overlapNormal);



    if (bodyA.bodyType === "kinematic" && bodyB.bodyType === "static") {


        let localNormal = worldDirectionToLocal(ecs, entityA, n[0], n[1]);
        const localTransformA = getTransform(ecs, entityA);
        if (localTransformA) {

            const localRotation = localTransformA.rotation ?? 0;
            const rotationRad = (localRotation * Math.PI) / 180;
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);
            const rotatedNormalX = localNormal.x * cos - localNormal.y * sin;
            const rotatedNormalY = localNormal.x * sin + localNormal.y * cos;
            localNormal = { x: rotatedNormalX, y: rotatedNormalY };
        }
        const localOverlap = worldDistanceToLocal(ecs, entityA, overlapAmount);
        const localCorrectionX = localNormal.x * localOverlap;
        const localCorrectionY = localNormal.y * localOverlap;

        if (bodyA.propagateCollision) {

            moveEntityAndParents(ecs, entityA, n[0] * overlapAmount, n[1] * overlapAmount);
        } else {

            const localTransform = getTransform(ecs, entityA);
            if (localTransform) {
                setTransform(ecs, entityA, {
                    x: localTransform.x + localCorrectionX,
                    y: localTransform.y + localCorrectionY,
                });
            }
        }
    } else if (bodyA.bodyType === "static" && bodyB.bodyType === "kinematic") {



        let localNormal = worldDirectionToLocal(ecs, entityB, -n[0], -n[1]);
        const localTransformB = getTransform(ecs, entityB);
        if (localTransformB) {

            const localRotation = localTransformB.rotation ?? 0;
            const rotationRad = (localRotation * Math.PI) / 180;
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);
            const rotatedNormalX = localNormal.x * cos - localNormal.y * sin;
            const rotatedNormalY = localNormal.x * sin + localNormal.y * cos;
            localNormal = { x: rotatedNormalX, y: rotatedNormalY };
        }
        const localOverlap = worldDistanceToLocal(ecs, entityB, overlapAmount);
        const localCorrectionX = localNormal.x * localOverlap;
        const localCorrectionY = localNormal.y * localOverlap;

        if (bodyB.propagateCollision) {

            moveEntityAndParents(ecs, entityB, -n[0] * overlapAmount, -n[1] * overlapAmount);
        } else {

            const localTransform = getTransform(ecs, entityB);
            if (localTransform) {
                setTransform(ecs, entityB, {
                    x: localTransform.x + localCorrectionX,
                    y: localTransform.y + localCorrectionY,
                });
            }
        }
    } else if (bodyA.bodyType === "kinematic" && bodyB.bodyType === "kinematic") {

        const halfOverlap = overlapAmount / 2;



        let localNormalA = worldDirectionToLocal(ecs, entityA, n[0], n[1]);
        const localTransformA = getTransform(ecs, entityA);
        if (localTransformA) {

            const localRotation = localTransformA.rotation ?? 0;
            const rotationRad = (localRotation * Math.PI) / 180;
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);
            const rotatedNormalX = localNormalA.x * cos - localNormalA.y * sin;
            const rotatedNormalY = localNormalA.x * sin + localNormalA.y * cos;
            localNormalA = { x: rotatedNormalX, y: rotatedNormalY };
        }
        const localOverlapA = worldDistanceToLocal(ecs, entityA, halfOverlap);
        const localCorrectionAX = localNormalA.x * localOverlapA;
        const localCorrectionAY = localNormalA.y * localOverlapA;



        let localNormalB = worldDirectionToLocal(ecs, entityB, -n[0], -n[1]);
        const localTransformB = getTransform(ecs, entityB);
        if (localTransformB) {

            const localRotation = localTransformB.rotation ?? 0;
            const rotationRad = (localRotation * Math.PI) / 180;
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);
            const rotatedNormalX = localNormalB.x * cos - localNormalB.y * sin;
            const rotatedNormalY = localNormalB.x * sin + localNormalB.y * cos;
            localNormalB = { x: rotatedNormalX, y: rotatedNormalY };
        }
        const localOverlapB = worldDistanceToLocal(ecs, entityB, halfOverlap);
        const localCorrectionBX = localNormalB.x * localOverlapB;
        const localCorrectionBY = localNormalB.y * localOverlapB;

        if (bodyA.propagateCollision) {

            moveEntityAndParents(ecs, entityA, n[0] * halfOverlap, n[1] * halfOverlap);
        } else {

            const localTransform = getTransform(ecs, entityA);
            if (localTransform) {
                setTransform(ecs, entityA, {
                    x: localTransform.x + localCorrectionAX,
                    y: localTransform.y + localCorrectionAY,
                });
            }
        }
        if (bodyB.propagateCollision) {

            moveEntityAndParents(ecs, entityB, -n[0] * halfOverlap, -n[1] * halfOverlap);
        } else {

            const localTransform = getTransform(ecs, entityB);
            if (localTransform) {
                setTransform(ecs, entityB, {
                    x: localTransform.x + localCorrectionBX,
                    y: localTransform.y + localCorrectionBY,
                });
            }
        }
    }

};

const MIN_BROADPHASE_ENTITIES = 32;
const BROADPHASE_CELL_SIZE = 128;

const getBroadphaseRadius = (ecs: ECSInstance, entity: Entity): number | null => {
    const collidersForEntity = getEntityCollisionColliders(ecs, entity);
    if (collidersForEntity.length === 0) return null;

    const worldTransform = getWorldTransform(ecs, entity);
    const scaleX = Math.abs(worldTransform?.scaleX ?? 1);
    const scaleY = Math.abs(worldTransform?.scaleY ?? 1);
    const maxScale = Math.max(scaleX, scaleY);

    let maxRadius = 0;
    let hasEnabledCollider = false;

    for (const { body, collider } of collidersForEntity) {
        if (!body.collisionEnabled) continue;

        const offsetX = collider.offsetX ?? 0;
        const offsetY = collider.offsetY ?? 0;
        const offsetDistance = Math.hypot(offsetX * scaleX, offsetY * scaleY);

        let baseRadius: number | null = null;

        if (collider.colliderName === "circle") {
            const radius = collider.radius ?? 16;
            baseRadius = radius * maxScale;
        } else if (collider.colliderName === "rectangle") {
            const width = (collider.width ?? 32) * scaleX;
            const height = (collider.height ?? 32) * scaleY;
            baseRadius = Math.hypot(width, height) / 2;
        } else if (collider.radius != null) {
            baseRadius = collider.radius * maxScale;
        } else if (collider.width != null || collider.height != null) {
            const width = (collider.width ?? 32) * scaleX;
            const height = (collider.height ?? 32) * scaleY;
            baseRadius = Math.hypot(width, height) / 2;
        } else {
            baseRadius = 32 * maxScale;
        }

        const totalRadius = baseRadius + offsetDistance;
        if (totalRadius > maxRadius) {
            maxRadius = totalRadius;
        }
        hasEnabledCollider = true;
    }

    return hasEnabledCollider ? maxRadius : null;
};

export const updateCollisions = (ecs: ECSInstance, entities: Entity[]) => {
    if (entities.length < MIN_BROADPHASE_ENTITIES) {
        for (let i = 0; i < entities.length; i++) {
            const entityA = entities[i];
            for (let j = i + 1; j < entities.length; j++) {
                handleCollisionPair(ecs, entityA, entities[j]);
            }
        }
        return;
    }

    const items: { entity: Entity; x: number; y: number; r: number }[] = [];

    for (const entity of entities) {
        const position = getCollisionPosition(ecs, entity);
        const radius = getBroadphaseRadius(ecs, entity);
        if (!position || radius == null) {
            for (let i = 0; i < entities.length; i++) {
                const entityA = entities[i];
                for (let j = i + 1; j < entities.length; j++) {
                    handleCollisionPair(ecs, entityA, entities[j]);
                }
            }
            return;
        }

        items.push({ entity, x: position[0], y: position[1], r: radius });
    }

    const cellMap = new Map<string, number[]>();
    const cellSize = BROADPHASE_CELL_SIZE;

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const minCellX = Math.floor((item.x - item.r) / cellSize);
        const maxCellX = Math.floor((item.x + item.r) / cellSize);
        const minCellY = Math.floor((item.y - item.r) / cellSize);
        const maxCellY = Math.floor((item.y + item.r) / cellSize);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                const key = `${cx},${cy}`;
                const bucket = cellMap.get(key);
                if (bucket) {
                    bucket.push(index);
                } else {
                    cellMap.set(key, [index]);
                }
            }
        }
    }

    const checkedPairs = new Set<string>();

    for (const bucket of cellMap.values()) {
        for (let i = 0; i < bucket.length; i++) {
            const indexA = bucket[i];
            const itemA = items[indexA];

            for (let j = i + 1; j < bucket.length; j++) {
                const indexB = bucket[j];
                const key = indexA < indexB ? `${indexA}|${indexB}` : `${indexB}|${indexA}`;
                if (checkedPairs.has(key)) continue;
                checkedPairs.add(key);

                const itemB = items[indexB];
                const dx = itemB.x - itemA.x;
                const dy = itemB.y - itemA.y;
                const radiusSum = itemA.r + itemB.r;

                if (dx * dx + dy * dy > radiusSum * radiusSum) {
                    continue;
                }

                handleCollisionPair(ecs, itemA.entity, itemB.entity);
            }
        }
    }
};

export const debugDrawColliders = (
    ecs: ECSInstance,
    entities: Entity[],
    context: CanvasRenderingContext2D
) => {
    entities.forEach((entity) => {
        const entityColliders = getEntityCollisionColliders(ecs, entity);
        for (const { body, collider } of entityColliders) {
            if (!body.collisionEnabled) continue;
            const override = buildColliderOverride(body, collider);
            const bodyOverride = buildBodyOverride(body);
            withCollisionOverrides([{ entity, collider: override, body: bodyOverride }], () => {
                const colliderName = override.colliderName ?? "rectangle";
                const colliderDef = colliders[colliderName];
                if (!colliderDef || !colliderDef.debugDraw) return;
                colliderDef.debugDraw(ecs, entity, context);
            });
        }
    });
};

const pointColliderCollisionSingle = (
    ecs: ECSInstance,
    point: Vector,
    entity: Entity
): boolean => {
    const body = getEntityCollisionBody(ecs, entity);
    const collider = getEntityCollider(ecs, entity);
    if (!body || !collider || !body.collisionEnabled) return false;

    const colliderName = collider.colliderName ?? "rectangle";
    const colliderDef = colliders[colliderName];
    if (!colliderDef) return false;

    const dummyEntity = "" as Entity;
    const normals = colliderDef.getNormals(ecs, entity, dummyEntity);

    for (const normal of normals) {
        const n = normalize(normal);
        const colliderProj = colliderDef.calculateProjection(ecs, entity, n);
        const pointProj = dot(point, n);

        if (pointProj < colliderProj.min || pointProj > colliderProj.max) {
            return false;
        }
    }

    return true;
};

export const pointColliderCollision = (
    ecs: ECSInstance,
    point: Vector,
    entity: Entity
): boolean => {
    const entityColliders = getEntityCollisionColliders(ecs, entity);
    for (const { body, collider } of entityColliders) {
        if (!body.collisionEnabled) continue;
        const override = buildColliderOverride(body, collider);
        const bodyOverride = buildBodyOverride(body);
        const hit = withCollisionOverrides([{ entity, collider: override, body: bodyOverride }], () =>
            pointColliderCollisionSingle(ecs, point, entity)
        );
        if (hit) return true;
    }
    return false;
};

registerCollider(RECTANGLE_COLLIDER);
registerCollider(CIRCLE_COLLIDER);

export { registerCollider, unregisterCollider };

