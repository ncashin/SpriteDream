import type { Vector } from "./vector";
import { create, add, sub, scale, dot, length, normalize } from "./vector";
import type { ECSInstance, Entity } from "./ecs/ecs";
import { getEntity } from "./ecs/ecs";
import {
  TransformComponentDefinition,
  VelocityComponentDefinition,
  ColliderComponentDefinition,
  type ColliderComponent,
} from "./ecs/component";
import {
  getCollisionCallback,
} from "./collision/collisionCallbacks";
import { getWorldPosition, getWorldTransform, getParents, moveEntityAndParents, getTransform, setTransform, worldDirectionToLocal, worldDistanceToLocal } from "./transform";
import { quadtree, type Quadtree } from "d3-quadtree";

// Entity data stored in quadtree
type QuadtreeEntity = {
  entity: Entity;
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
};

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
  const velocity = getEntity(ecs, entity)[VelocityComponentDefinition.type] as typeof VelocityComponentDefinition | undefined;
  if (!velocity) return null;
  return create(velocity.x, velocity.y);
};

export const getEntityCollider = (
  ecs: ECSInstance,
  entity: Entity
): ColliderComponent | null => {
  return (getEntity(ecs, entity)[ColliderComponentDefinition.type] as ColliderComponent | undefined) ?? null;
};

export const getCollisionPosition = (
  ecs: ECSInstance,
  entity: Entity
): Vector | null => {
  const position = getEntityPosition(ecs, entity);
  if (!position) return null;

  // Transforms handle positioning, so collision position is just the entity's world position
  return position;
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

export type ColliderDefinition = {
  name: string;
  getNormals: (ecs: ECSInstance, entity: Entity, other: Entity) => Vector[];
  getClosestPoint: (ecs: ECSInstance, entity: Entity, point: Vector) => Vector;
  calculateProjection: (
    ecs: ECSInstance,
    entity: Entity,
    normal: Vector
  ) => { min: number; max: number };
  debugDraw?: (
    ecs: ECSInstance,
    entity: Entity,
    context: CanvasRenderingContext2D
  ) => void;
};

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

export const colliders: { [name: string]: ColliderDefinition } = {};
export const registerCollider = (collider: ColliderDefinition) => {
  colliders[collider.name] = collider;
};
export const unregisterCollider = (name: string) => {
  delete colliders[name];
};

export const handleCollisionPair = (
  ecs: ECSInstance,
  entityA: Entity,
  entityB: Entity
) => {
  // Prevent entities from colliding with themselves
  if (entityA === entityB) return;

  const colliderA = getEntityCollider(ecs, entityA);
  const colliderB = getEntityCollider(ecs, entityB);

  if (!colliderA || !colliderB) return;
  if (!colliderA.collisionEnabled || !colliderB.collisionEnabled) return;

  const colliderDefA = colliders[colliderA.colliderName];
  const colliderDefB = colliders[colliderB.colliderName];

  if (!colliderDefA || !colliderDefB) {
    console.warn(
      `Missing collider for entity: ${colliderA.colliderName} or ${colliderB.colliderName}`
    );
    return;
  }

  // Use custom resolver if set, otherwise use default
  const resolver = customResolver || defaultCollisionResolver;

  const normalsA = colliderDefA.getNormals(ecs, entityA, entityB);
  const normalsB = colliderDefB.getNormals(ecs, entityB, entityA);

  // Deduplicate normals to avoid redundant checks (especially for rectangle-rectangle)
  const normals: Vector[] = [];
  const normalSet = new Set<string>();

  for (const normal of normalsA) {
    const key = `${normal[0].toFixed(6)},${normal[1].toFixed(6)}`;
    if (!normalSet.has(key)) {
      normals.push(normal);
      normalSet.add(key);
    }
  }

  for (const normal of normalsB) {
    const key = `${normal[0].toFixed(6)},${normal[1].toFixed(6)}`;
    if (!normalSet.has(key)) {
      normals.push(normal);
      normalSet.add(key);
    }
  }

  let minOverlap = Infinity;
  let smallestNormal: Vector | null = null;

  for (const normal of normals) {
    // Check if normal is already normalized (length ≈ 1) to avoid unnecessary normalization
    const lenSq = normal[0] * normal[0] + normal[1] * normal[1];
    const n = Math.abs(lenSq - 1.0) < 0.0001 ? normal : normalize(normal);

    const projA = colliderDefA.calculateProjection(ecs, entityA, n);
    const projB = colliderDefB.calculateProjection(ecs, entityB, n);

    // Early exit: if projections don't overlap, shapes are separated
    if (projA.max < projB.min || projB.max < projA.min) {
      // Found a separating axis - shapes don't collide
      minOverlap = 0;
      smallestNormal = null;
      break;
    }

    // Calculate overlap: positive means shapes overlap
    const overlapA = projB.max - projA.min; // How much A overlaps B (A needs to move along +n)
    const overlapB = projA.max - projB.min; // How much B overlaps A (A needs to move along -n)

    // Choose the smaller overlap (minimum translation distance)
    // Determine which direction A should move to separate
    let currentOverlap: number;
    let currentNormal: Vector;

    if (overlapA < overlapB) {
      // A overlaps B less, so move A along +n
      currentOverlap = overlapA;
      currentNormal = n;
    } else {
      // B overlaps A less, so move A along -n (or equivalently, reverse normal)
      currentOverlap = overlapB;
      currentNormal = scale(n, -1);
    }

    if (currentOverlap < minOverlap) {
      minOverlap = currentOverlap;
      smallestNormal = currentNormal;
    }
  }

  if (smallestNormal && minOverlap > 0 && minOverlap < Infinity) {
    // overlapAmount is positive and represents how much to move along the normal
    // The normal represents the direction entityA should move to separate from entityB
    resolver(
      ecs,
      entityA,
      entityB,
      minOverlap,
      smallestNormal
    );

    // Trigger collision callbacks
    // Convert normals to local space for each entity's callback
    // For entityA's callback: pass the normal in entityA's local space (direction A should move)
    // For entityB's callback: pass reversed normal in entityB's local space (direction B should move, which is opposite)
    if (colliderA.callbackName) {
      const callbackDef = getCollisionCallback(colliderA.callbackName);
      if (callbackDef) {
        // Convert from world space to parent's local space, then rotate by entity's own rotation
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
        callbackDef.callback(
          ecs,
          entityA,
          entityB,
          minOverlap,
          localNormalVector
        );
      }
    }

    // Trigger callbacks for all parents of entityA if propagateCollision is enabled
    if (colliderA.propagateCollision) {
      const parentsA = getParents(ecs, entityA);
      for (const parentA of parentsA) {
        const parentCollider = getEntityCollider(ecs, parentA);
        if (parentCollider?.callbackName) {
          const parentCallbackDef = getCollisionCallback(parentCollider.callbackName);
          if (parentCallbackDef) {
            // Convert from world space to parent's local space, then rotate by entity's own rotation
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
            parentCallbackDef.callback(
              ecs,
              parentA,
              entityB,
              minOverlap,
              localNormalVectorParentA
            );
          }
        }
      }
    }

    if (colliderB.callbackName) {
      const callbackDef = getCollisionCallback(colliderB.callbackName);
      if (callbackDef) {
        const reversedNormal = scale(smallestNormal, -1);
        // Convert from world space to parent's local space, then rotate by entity's own rotation
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
        callbackDef.callback(
          ecs,
          entityB,
          entityA,
          minOverlap,
          localNormalVectorB
        );
      }
    }

    // Trigger callbacks for all parents of entityB if propagateCollision is enabled
    if (colliderB.propagateCollision) {
      const parentsB = getParents(ecs, entityB);
      for (const parentB of parentsB) {
        const parentCollider = getEntityCollider(ecs, parentB);
        if (parentCollider?.callbackName) {
          const parentCallbackDef = getCollisionCallback(parentCollider.callbackName);
          if (parentCallbackDef) {
            const reversedNormal = scale(smallestNormal, -1);
            // Convert from world space to parent's local space, then rotate by entity's own rotation
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
            parentCallbackDef.callback(
              ecs,
              parentB,
              entityA,
              minOverlap,
              localNormalVectorParentB
            );
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

  const colliderA = getEntityCollider(ecs, entityA);
  const colliderB = getEntityCollider(ecs, entityB);

  if (!colliderA || !colliderB) return;

  const transformA = getEntity(ecs, entityA)[TransformComponentDefinition.type] as typeof TransformComponentDefinition | undefined;
  const transformB = getEntity(ecs, entityB)[TransformComponentDefinition.type] as typeof TransformComponentDefinition | undefined;

  if (!transformA || !transformB) return;

  // Normal represents the direction entityA should move to separate from entityB (in world space)
  // overlapAmount is always positive and represents separation distance (in world space)
  const n = normalize(overlapNormal);

  // Default behavior based on body types
  // Always separate kinematic bodies from static bodies fully
  if (colliderA.bodyType === "kinematic" && colliderB.bodyType === "static") {
    // Convert normal and overlap to local space for entityA
    // First convert from world space to parent's local space, then rotate by entity's own rotation
    let localNormal = worldDirectionToLocal(ecs, entityA, n[0], n[1]);
    const localTransformA = getTransform(ecs, entityA);
    if (localTransformA) {
      // Rotate the normal by the entity's own local rotation
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

    if (colliderA.propagateCollision) {
      // Move entityA and all its parents in world space
      moveEntityAndParents(ecs, entityA, n[0] * overlapAmount, n[1] * overlapAmount);
    } else {
      // Move only entityA in local space
      const localTransform = getTransform(ecs, entityA);
      if (localTransform) {
        setTransform(ecs, entityA, {
          x: localTransform.x + localCorrectionX,
          y: localTransform.y + localCorrectionY,
        });
      }
    }
  } else if (colliderA.bodyType === "static" && colliderB.bodyType === "kinematic") {
    // Move B opposite to normal (since normal is from A's perspective)
    // Convert normal and overlap to local space for entityB
    // First convert from world space to parent's local space, then rotate by entity's own rotation
    let localNormal = worldDirectionToLocal(ecs, entityB, -n[0], -n[1]);
    const localTransformB = getTransform(ecs, entityB);
    if (localTransformB) {
      // Rotate the normal by the entity's own local rotation
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

    if (colliderB.propagateCollision) {
      // Move entityB and all its parents in world space
      moveEntityAndParents(ecs, entityB, -n[0] * overlapAmount, -n[1] * overlapAmount);
    } else {
      // Move only entityB in local space
      const localTransform = getTransform(ecs, entityB);
      if (localTransform) {
        setTransform(ecs, entityB, {
          x: localTransform.x + localCorrectionX,
          y: localTransform.y + localCorrectionY,
        });
      }
    }
  } else if (colliderA.bodyType === "kinematic" && colliderB.bodyType === "kinematic") {
    // Split separation between both kinematic bodies
    const halfOverlap = overlapAmount / 2;

    // Convert normal and half overlap to local space for entityA
    // First convert from world space to parent's local space, then rotate by entity's own rotation
    let localNormalA = worldDirectionToLocal(ecs, entityA, n[0], n[1]);
    const localTransformA = getTransform(ecs, entityA);
    if (localTransformA) {
      // Rotate the normal by the entity's own local rotation
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

    // Convert normal and half overlap to local space for entityB (opposite direction)
    // First convert from world space to parent's local space, then rotate by entity's own rotation
    let localNormalB = worldDirectionToLocal(ecs, entityB, -n[0], -n[1]);
    const localTransformB = getTransform(ecs, entityB);
    if (localTransformB) {
      // Rotate the normal by the entity's own local rotation
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

    if (colliderA.propagateCollision) {
      // Move entityA and all its parents in world space
      moveEntityAndParents(ecs, entityA, n[0] * halfOverlap, n[1] * halfOverlap);
    } else {
      // Move only entityA in local space
      const localTransform = getTransform(ecs, entityA);
      if (localTransform) {
        setTransform(ecs, entityA, {
          x: localTransform.x + localCorrectionAX,
          y: localTransform.y + localCorrectionAY,
        });
      }
    }
    if (colliderB.propagateCollision) {
      // Move entityB and all its parents in world space (opposite direction)
      moveEntityAndParents(ecs, entityB, -n[0] * halfOverlap, -n[1] * halfOverlap);
    } else {
      // Move only entityB in local space
      const localTransform = getTransform(ecs, entityB);
      if (localTransform) {
        setTransform(ecs, entityB, {
          x: localTransform.x + localCorrectionBX,
          y: localTransform.y + localCorrectionBY,
        });
      }
    }
  }
  // If both static, do nothing
};

// Get entity bounding box for quadtree
const getEntityBounds = (
  ecs: ECSInstance,
  entity: Entity
): { x: number; y: number; halfWidth: number; halfHeight: number } | null => {
  const position = getCollisionPosition(ecs, entity);
  const collider = getEntityCollider(ecs, entity);
  if (!position || !collider) return null;

  const worldTransform = getWorldTransform(ecs, entity);

  // Calculate bounding box based on collider type
  let halfWidth: number;
  let halfHeight: number;

  if (collider.colliderName === "circle") {
    const baseRadius = collider.radius ?? 16;
    const scaleFactor = worldTransform ? Math.max(worldTransform.scaleX, worldTransform.scaleY) : 1;
    const radius = baseRadius * scaleFactor;
    halfWidth = radius;
    halfHeight = radius;
  } else {
    // Rectangle or default
    const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
    const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);

    // For rotated rectangles, compute AABB
    const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
    const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
    const totalAngle = colliderAngle + transformAngle;

    const cos = Math.abs(Math.cos(totalAngle));
    const sin = Math.abs(Math.sin(totalAngle));

    // AABB half-dimensions for rotated rectangle
    halfWidth = (width * cos + height * sin) / 2;
    halfHeight = (width * sin + height * cos) / 2;
  }

  return { x: position[0], y: position[1], halfWidth, halfHeight };
};

// Check if two AABBs overlap
const aabbOverlap = (a: QuadtreeEntity, b: QuadtreeEntity): boolean => {
  return Math.abs(a.x - b.x) <= a.halfWidth + b.halfWidth &&
    Math.abs(a.y - b.y) <= a.halfHeight + b.halfHeight;
};

export const updateCollisions = (ecs: ECSInstance, entities: Entity[]) => {
  if (entities.length < 10) {
    // For small numbers of entities, brute force is faster due to quadtree overhead
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        handleCollisionPair(ecs, entities[i], entities[j]);
      }
    }
    return;
  }

  // Build quadtree with entity bounds
  const quadtreeEntities: QuadtreeEntity[] = [];
  for (const entity of entities) {
    const bounds = getEntityBounds(ecs, entity);
    if (bounds) {
      quadtreeEntities.push({
        entity,
        x: bounds.x,
        y: bounds.y,
        halfWidth: bounds.halfWidth,
        halfHeight: bounds.halfHeight,
      });
    }
  }

  const tree: Quadtree<QuadtreeEntity> = quadtree<QuadtreeEntity>()
    .x(d => d.x)
    .y(d => d.y)
    .addAll(quadtreeEntities);

  // Track checked pairs to avoid duplicates
  const checkedPairs = new Set<string>();

  // For each entity, query the quadtree for potential collisions
  for (const entityData of quadtreeEntities) {
    // Define search bounds (AABB of current entity)
    const searchMinX = entityData.x - entityData.halfWidth;
    const searchMinY = entityData.y - entityData.halfHeight;
    const searchMaxX = entityData.x + entityData.halfWidth;
    const searchMaxY = entityData.y + entityData.halfHeight;

    // Visit nodes in the quadtree
    tree.visit((node, x1, y1, x2, y2) => {
      // If this is a leaf node with data
      if (!node.length) {
        let current: typeof node | undefined = node;
        do {
          const candidate = current.data;
          if (candidate && candidate.entity !== entityData.entity) {
            // Create a canonical pair key to avoid duplicate checks
            const pairKey = entityData.entity < candidate.entity
              ? `${entityData.entity}:${candidate.entity}`
              : `${candidate.entity}:${entityData.entity}`;

            if (!checkedPairs.has(pairKey)) {
              // Check AABB overlap before SAT
              if (aabbOverlap(entityData, candidate)) {
                checkedPairs.add(pairKey);
                handleCollisionPair(ecs, entityData.entity, candidate.entity);
              }
            }
          }
          current = current.next;
        } while (current);
      }

      // Return true to skip this subtree if it doesn't overlap with our search bounds
      // Check if any part of the node bounds could overlap with entity's AABB
      // We need to account for the maximum possible collider size in the subtree
      // For simplicity, we expand the search by checking if node bounds intersect with expanded entity bounds
      const maxColliderSize = 200; // Conservative estimate for max collider size
      return x1 > searchMaxX + maxColliderSize ||
        x2 < searchMinX - maxColliderSize ||
        y1 > searchMaxY + maxColliderSize ||
        y2 < searchMinY - maxColliderSize;
    });
  }
};

export const debugDrawColliders = (
  ecs: ECSInstance,
  entities: Entity[],
  context: CanvasRenderingContext2D
) => {
  entities.forEach((entity) => {
    const collider = getEntityCollider(ecs, entity);
    if (!collider) return;
    const colliderDef = colliders[collider.colliderName];
    if (!colliderDef || !colliderDef.debugDraw) return;
    colliderDef.debugDraw(ecs, entity, context);
  });
};

export const RECTANGLE_COLLIDER: ColliderDefinition = {
  name: "rectangle",
  getNormals: (ecs, entity, _other) => {
    const collider = getEntityCollider(ecs, entity);
    const worldTransform = getWorldTransform(ecs, entity);
    const colliderAngle = (collider?.angle ?? 0) * Math.PI / 180;
    const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
    const totalAngle = colliderAngle + transformAngle;
    const cos = Math.cos(totalAngle);
    const sin = Math.sin(totalAngle);

    const rotateVector = (v: Vector) =>
      create(v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos);

    return [rotateVector(create(0, 1)), rotateVector(create(1, 0))];
  },

  getClosestPoint: (ecs, entity, point) => {
    const collider = getEntityCollider(ecs, entity);
    const center = getCollisionPosition(ecs, entity);
    if (!collider || !center) return point;

    const worldTransform = getWorldTransform(ecs, entity);
    const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
    const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);
    const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
    const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
    const totalAngle = colliderAngle + transformAngle;

    const localPoint = sub(point, center);
    const cos = Math.cos(-totalAngle);
    const sin = Math.sin(-totalAngle);

    const rotatedPoint = create(
      localPoint[0] * cos - localPoint[1] * sin,
      localPoint[0] * sin + localPoint[1] * cos
    );

    const hw = width / 2;
    const hh = height / 2;
    const clampedX = Math.max(-hw, Math.min(hw, rotatedPoint[0]));
    const clampedY = Math.max(-hh, Math.min(hh, rotatedPoint[1]));

    const localClamped = create(clampedX, clampedY);
    const cos2 = Math.cos(totalAngle);
    const sin2 = Math.sin(totalAngle);

    const worldClamped = create(
      localClamped[0] * cos2 - localClamped[1] * sin2,
      localClamped[0] * sin2 + localClamped[1] * cos2
    );

    return add(center, worldClamped);
  },

  calculateProjection: (ecs, entity, normal) => {
    const collider = getEntityCollider(ecs, entity);
    const center = getCollisionPosition(ecs, entity);
    if (!collider || !center) return { min: 0, max: 0 };

    const worldTransform = getWorldTransform(ecs, entity);
    const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
    const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);
    const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
    const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
    const totalAngle = colliderAngle + transformAngle;

    const hw = width / 2;
    const hh = height / 2;

    // Optimize: Calculate projection directly without computing all corners
    // Project the local axes onto the normal, then use half-widths/half-heights
    const cos = Math.cos(totalAngle);
    const sin = Math.sin(totalAngle);

    // Local axes rotated to world space
    const localAxisX = create(cos, sin);
    const localAxisY = create(-sin, cos);

    // Project local axes onto the normal
    const projX = Math.abs(dot(localAxisX, normal));
    const projY = Math.abs(dot(localAxisY, normal));

    // Projection extent = half-width * projection of X axis + half-height * projection of Y axis
    const extent = hw * projX + hh * projY;

    // Center projection
    const centerProj = dot(center, normal);

    return {
      min: centerProj - extent,
      max: centerProj + extent,
    };
  },

  debugDraw: (ecs, entity, context) => {
    const collider = getEntityCollider(ecs, entity);
    const center = getCollisionPosition(ecs, entity);
    if (!collider || !center) return;

    const worldTransform = getWorldTransform(ecs, entity);
    const width = (collider.width ?? 32) * (worldTransform?.scaleX ?? 1);
    const height = (collider.height ?? 32) * (worldTransform?.scaleY ?? 1);
    const colliderAngle = (collider.angle ?? 0) * Math.PI / 180;
    const transformAngle = worldTransform ? (worldTransform.rotation * Math.PI) / 180 : 0;
    const totalAngle = colliderAngle + transformAngle;

    context.save();
    context.strokeStyle = "#ff0000";
    context.lineWidth = 2;

    context.translate(center[0], center[1]);
    context.rotate(totalAngle);

    context.strokeRect(-width / 2, -height / 2, width, height);
    context.restore();
  },
};

export const CIRCLE_COLLIDER: ColliderDefinition = {
  name: "circle",
  getNormals: (ecs, entity, other) => {
    const position = getCollisionPosition(ecs, entity);
    if (!position) return [];

    const otherCollider = getEntityCollider(ecs, other);
    if (!otherCollider) return [];

    const otherColliderDef = colliders[otherCollider.colliderName];
    if (!otherColliderDef) return [];

    const closestPoint = otherColliderDef.getClosestPoint(ecs, other, position);
    const direction = sub(closestPoint, position);
    if (length(direction) > 0) {
      return [normalize(direction)];
    }
    return [];
  },

  getClosestPoint: (ecs, entity, point) => {
    const position = getCollisionPosition(ecs, entity);
    const collider = getEntityCollider(ecs, entity);
    if (!position || !collider) return point;

    const worldTransform = getWorldTransform(ecs, entity);
    const baseRadius = collider.radius ?? 16;
    const scaleFactor = worldTransform ? Math.max(worldTransform.scaleX, worldTransform.scaleY) : 1;
    const radius = baseRadius * scaleFactor;
    const direction = sub(point, position);
    if (length(direction) <= radius) {
      return point;
    }
    return add(position, scale(normalize(direction), radius));
  },

  calculateProjection: (ecs, entity, normal) => {
    const position = getCollisionPosition(ecs, entity);
    const collider = getEntityCollider(ecs, entity);
    if (!position || !collider) return { min: 0, max: 0 };

    const worldTransform = getWorldTransform(ecs, entity);
    const baseRadius = collider.radius ?? 16;
    const scale = worldTransform ? Math.max(worldTransform.scaleX, worldTransform.scaleY) : 1;
    const radius = baseRadius * scale;
    const projection = dot(position, normal);
    return {
      min: projection - radius,
      max: projection + radius,
    };
  },

  debugDraw: (ecs, entity, context) => {
    const position = getCollisionPosition(ecs, entity);
    const collider = getEntityCollider(ecs, entity);
    const velocity = getEntityVelocity(ecs, entity);
    if (!position || !collider) return;

    const worldTransform = getWorldTransform(ecs, entity);
    const baseRadius = collider.radius ?? 16;
    const scale = worldTransform ? Math.max(worldTransform.scaleX, worldTransform.scaleY) : 1;
    const radius = baseRadius * scale;

    context.save();
    context.strokeStyle = "#ff0000";
    context.lineWidth = 2;

    context.beginPath();
    context.arc(position[0], position[1], radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    if (velocity) {
      context.save();
      context.strokeStyle = "#00ff00";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(position[0], position[1]);
      const scaleFactor = 0.1;
      context.lineTo(
        position[0] + velocity[0] * scaleFactor,
        position[1] + velocity[1] * scaleFactor
      );
      context.stroke();
      context.restore();
    }
  },
};

export const pointColliderCollision = (
  ecs: ECSInstance,
  point: Vector,
  entity: Entity
): boolean => {
  const collider = getEntityCollider(ecs, entity);
  if (!collider || !collider.collisionEnabled) return false;

  const colliderDef = colliders[collider.colliderName];
  if (!colliderDef) return false;

  const dummyEntity = "" as Entity;
  const normals = colliderDef.getNormals(ecs, entity, dummyEntity);

  for (const normal of normals) {
    // Check if normal is already normalized (length ≈ 1) to avoid unnecessary normalization
    const lenSq = normal[0] * normal[0] + normal[1] * normal[1];
    const n = Math.abs(lenSq - 1.0) < 0.0001 ? normal : normalize(normal);

    const colliderProj = colliderDef.calculateProjection(ecs, entity, n);
    const pointProj = dot(point, n);

    // Early exit: if point is outside projection range, no collision
    if (pointProj < colliderProj.min || pointProj > colliderProj.max) {
      return false;
    }
  }

  return true;
};

registerCollider(RECTANGLE_COLLIDER);
registerCollider(CIRCLE_COLLIDER);
