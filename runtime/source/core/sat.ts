import type { Vector } from "./vector";
import { create, add, sub, scale, dot, length, normalize } from "./vector";
import type { ECSInstance, Entity } from "./ecs/ecs";
import { getComponent } from "./ecs/ecs";
import {
  PositionComponentDefinition,
  VelocityComponentDefinition,
  ColliderComponentDefinition,
  type ColliderComponent,
} from "./ecs/component";
import {
  getCollisionCallback,
} from "./collision/collisionCallbacks";

export const getEntityPosition = (
  ecs: ECSInstance,
  entity: Entity
): Vector | null => {
  const position = getComponent(ecs, entity, PositionComponentDefinition);
  if (!position) return null;
  return create(position.x, position.y);
};

export const getEntityVelocity = (
  ecs: ECSInstance,
  entity: Entity
): Vector | null => {
  const velocity = getComponent(ecs, entity, VelocityComponentDefinition);
  if (!velocity) return null;
  return create(velocity.x, velocity.y);
};

export const getEntityCollider = (
  ecs: ECSInstance,
  entity: Entity
): ColliderComponent | null => {
  return getComponent(ecs, entity, ColliderComponentDefinition) ?? null;
};

export const getCollisionPosition = (
  ecs: ECSInstance,
  entity: Entity
): Vector | null => {
  const position = getEntityPosition(ecs, entity);
  const collider = getEntityCollider(ecs, entity);
  if (!position || !collider) return null;

  const offsetX = collider.offsetX ?? 0;
  const offsetY = collider.offsetY ?? 0;
  return add(position, create(offsetX, offsetY));
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

    // Calculate overlap: positive means shapes overlap
    const overlapA = projB.max - projA.min; // How much A overlaps B (A needs to move along +n)
    const overlapB = projA.max - projB.min; // How much B overlaps A (A needs to move along -n)

    // If there's no overlap along this axis, shapes are separated (but check other axes)
    if (overlapA <= 0 || overlapB <= 0) {
      // Found a separating axis - shapes don't collide
      minOverlap = 0;
      smallestNormal = null;
      break;
    }

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
    // For entityA's callback: pass the normal as-is (direction A should move)
    // For entityB's callback: pass reversed normal (direction B should move, which is opposite)
    if (colliderA.callbackName) {
      const callbackDef = getCollisionCallback(colliderA.callbackName);
      if (callbackDef) {
        callbackDef.callback(
          ecs,
          entityA,
          entityB,
          minOverlap,
          smallestNormal
        );
      }
    }

    if (colliderB.callbackName) {
      const callbackDef = getCollisionCallback(colliderB.callbackName);
      if (callbackDef) {
        callbackDef.callback(
          ecs,
          entityB,
          entityA,
          minOverlap,
          scale(smallestNormal, -1)
        );
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

  const positionA = getComponent(ecs, entityA, PositionComponentDefinition);
  const positionB = getComponent(ecs, entityB, PositionComponentDefinition);

  if (!positionA || !positionB) return;

  // Normal represents the direction entityA should move to separate from entityB
  // overlapAmount is always positive and represents separation distance
  const n = normalize(overlapNormal);

  // Default behavior based on body types
  // Always separate kinematic bodies from static bodies fully
  if (colliderA.bodyType === "kinematic" && colliderB.bodyType === "static") {
    // Move A along normal to separate from B
    const correction = scale(n, overlapAmount);
    positionA.x += correction[0];
    positionA.y += correction[1];
  } else if (colliderA.bodyType === "static" && colliderB.bodyType === "kinematic") {
    // Move B opposite to normal (since normal is from A's perspective)
    const correction = scale(n, -overlapAmount);
    positionB.x += correction[0];
    positionB.y += correction[1];
  } else if (colliderA.bodyType === "kinematic" && colliderB.bodyType === "kinematic") {
    // Split separation between both kinematic bodies
    const halfCorrection = scale(n, overlapAmount / 2);
    positionA.x += halfCorrection[0];
    positionA.y += halfCorrection[1];
    positionB.x -= halfCorrection[0];
    positionB.y -= halfCorrection[1];
  }
  // If both static, do nothing
};

export const updateCollisions = (ecs: ECSInstance, entities: Entity[]) => {
  for (let i = 0; i < entities.length; i++) {
    const entityA = entities[i];

    for (let j = i + 1; j < entities.length; j++) {
      const entityB = entities[j];
      handleCollisionPair(ecs, entityA, entityB);
    }
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
    const angle = (((collider?.angle ?? 0) || 0) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rotateVector = (v: Vector) =>
      create(v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos);

    return [rotateVector(create(0, 1)), rotateVector(create(1, 0))];
  },

  getClosestPoint: (ecs, entity, point) => {
    const collider = getEntityCollider(ecs, entity);
    const center = getCollisionPosition(ecs, entity);
    if (!collider || !center) return point;

    const width = collider.width ?? 32;
    const height = collider.height ?? 32;
    const angle = ((collider.angle ?? 0) * Math.PI) / 180;

    const localPoint = sub(point, center);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    const rotatedPoint = create(
      localPoint[0] * cos - localPoint[1] * sin,
      localPoint[0] * sin + localPoint[1] * cos
    );

    const hw = width / 2;
    const hh = height / 2;
    const clampedX = Math.max(-hw, Math.min(hw, rotatedPoint[0]));
    const clampedY = Math.max(-hh, Math.min(hh, rotatedPoint[1]));

    const localClamped = create(clampedX, clampedY);
    const cos2 = Math.cos(angle);
    const sin2 = Math.sin(angle);

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

    const width = collider.width ?? 32;
    const height = collider.height ?? 32;
    const angle = ((collider.angle ?? 0) * Math.PI) / 180;

    const hw = width / 2;
    const hh = height / 2;

    const localCorners = [
      create(-hw, -hh),
      create(hw, -hh),
      create(hw, hh),
      create(-hw, hh),
    ];

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const corners = localCorners.map((localCorner) => {
      const worldCorner = create(
        localCorner[0] * cos - localCorner[1] * sin,
        localCorner[0] * sin + localCorner[1] * cos
      );
      return add(center, worldCorner);
    });

    const projections = corners.map((corner) => dot(corner, normal));
    return {
      min: Math.min(...projections),
      max: Math.max(...projections),
    };
  },

  debugDraw: (ecs, entity, context) => {
    const collider = getEntityCollider(ecs, entity);
    const center = getCollisionPosition(ecs, entity);
    if (!collider || !center) return;

    const width = collider.width ?? 32;
    const height = collider.height ?? 32;
    const angle = ((collider.angle ?? 0) * Math.PI) / 180;

    context.save();
    context.strokeStyle = "#ff0000";
    context.lineWidth = 2;

    context.translate(center[0], center[1]);
    context.rotate(angle);

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

    const radius = collider.radius ?? 16;
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

    const radius = collider.radius ?? 16;
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

    const radius = collider.radius ?? 16;

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

registerCollider(RECTANGLE_COLLIDER);
registerCollider(CIRCLE_COLLIDER);
