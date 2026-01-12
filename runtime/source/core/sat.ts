import type { Vector } from "./vector";
import { create, add, sub, scale, dot, length, normalize } from "./vector";
import type { ECSInstance, Entity } from "./ecs/ecs";
import { getComponent } from "./ecs/ecs";
import {
  PositionComponentDefinition,
  VelocityComponentDefinition,
  ColliderComponentDefinition,
  type PositionComponent,
  type VelocityComponent,
  type ColliderComponent,
} from "./ecs/component";

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

export type ResolverDefinition = {
  name: string;
  resolveCollision: (
    ecs: ECSInstance,
    entity: Entity,
    other: Entity,
    overlapAmount: number,
    overlapNormal: Vector
  ) => void;
};

export const resolvers: { [name: string]: ResolverDefinition } = {};
export const registerResolver = (resolver: ResolverDefinition) => {
  resolvers[resolver.name] = resolver;
};
export const unregisterResolver = (name: string) => {
  delete resolvers[name];
};

export type CollisionCallback = (
  ecs: ECSInstance,
  entity: Entity,
  other: Entity,
  overlapAmount: number,
  overlapNormal: Vector
) => void;

const collisionCallbacks: Map<Entity, CollisionCallback[]> = new Map();

export const addCollisionCallback = (
  entity: Entity,
  callback: CollisionCallback
) => {
  if (!collisionCallbacks.has(entity)) {
    collisionCallbacks.set(entity, []);
  }
  collisionCallbacks.get(entity)!.push(callback);
};

export const removeCollisionCallback = (
  entity: Entity,
  callback: CollisionCallback
) => {
  const callbacks = collisionCallbacks.get(entity);
  if (callbacks) {
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
};

export const clearCollisionCallbacks = (entity: Entity) => {
  collisionCallbacks.delete(entity);
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
  const colliderA = getEntityCollider(ecs, entityA);
  const colliderB = getEntityCollider(ecs, entityB);

  if (!colliderA || !colliderB) return;
  if (!colliderA.collisionEnabled || !colliderB.collisionEnabled) return;

  const colliderDefA = colliders[colliderA.colliderName];
  const resolverA = resolvers[colliderA.resolverName];

  if (!colliderDefA || !resolverA) {
    console.warn(
      `Missing collider or resolver for entity A: ${colliderA.colliderName}, ${colliderA.resolverName}`
    );
    return;
  }

  const colliderDefB = colliders[colliderB.colliderName];
  const resolverB = resolvers[colliderB.resolverName];

  if (!colliderDefB || !resolverB) {
    console.warn(
      `Missing collider or resolver for entity B: ${colliderB.colliderName}, ${colliderB.resolverName}`
    );
    return;
  }

  const normals = [
    ...colliderDefA.getNormals(ecs, entityA, entityB),
    ...colliderDefB.getNormals(ecs, entityB, entityA),
  ];

  let minOverlap = Infinity;
  let smallestNormal: Vector | null = null;
  let direction: number = 1;

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
    let currentDirection: number;

    if (overlapA < overlapB) {
      currentOverlap = overlapA;
      currentDirection = 1;
    } else {
      currentOverlap = overlapB;
      currentDirection = -1;
    }

    if (currentOverlap < minOverlap) {
      minOverlap = currentOverlap;
      smallestNormal = n;
      direction = currentDirection;
    }
  }

  if (smallestNormal && minOverlap > 0 && minOverlap < Infinity) {
    resolverA.resolveCollision(
      ecs,
      entityA,
      entityB,
      minOverlap * direction,
      smallestNormal
    );
    resolverB.resolveCollision(
      ecs,
      entityB,
      entityA,
      minOverlap * -direction,
      smallestNormal
    );

    const callbacksA = collisionCallbacks.get(entityA);
    if (callbacksA) {
      for (const callback of callbacksA) {
        callback(ecs, entityA, entityB, minOverlap * direction, smallestNormal);
      }
    }

    const callbacksB = collisionCallbacks.get(entityB);
    if (callbacksB) {
      for (const callback of callbacksB) {
        callback(
          ecs,
          entityB,
          entityA,
          minOverlap * -direction,
          smallestNormal
        );
      }
    }
  }
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

export const STATIC_RESOLVER: ResolverDefinition = {
  name: "static",
  resolveCollision: (
    _ecs,
    _entity,
    _other,
    _overlapAmount,
    _overlapNormal
  ) => {},
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

export const BOUNCY_RESOLVER: ResolverDefinition = {
  name: "bouncy",
  resolveCollision: (ecs, entity, _other, overlapAmount, overlapNormal) => {
    const position = getComponent(ecs, entity, PositionComponentDefinition);
    const velocity = getComponent(ecs, entity, VelocityComponentDefinition);
    const collider = getComponent(ecs, entity, ColliderComponentDefinition);

    if (!position || !velocity || !collider) return;

    const offsetX = collider.offsetX ?? 0;
    const offsetY = collider.offsetY ?? 0;

    const n = normalize(overlapNormal);
    const correction = scale(n, overlapAmount);
    position.x += correction[0];
    position.y += correction[1];

    const vel = create(velocity.x, velocity.y);
    const vDotN = dot(vel, n);
    const COLLISION_DAMPING = 0.7;

    const newVel = sub(vel, scale(n, (1 + COLLISION_DAMPING) * vDotN));

    const tangent = create(-n[1], n[0]);
    const vDotT = dot(newVel, tangent);
    const FRICTION = 0.2;
    const finalVel = sub(newVel, scale(tangent, vDotT * FRICTION));

    const VELOCITY_EPSILON_X = 10;
    const VELOCITY_EPSILON_Y = 40;
    let vx = finalVel[0];
    let vy = finalVel[1];
    if (Math.abs(vx) < VELOCITY_EPSILON_X) vx = 0;
    if (Math.abs(vy) < VELOCITY_EPSILON_Y) vy = 0;

    velocity.x = vx;
    velocity.y = vy;
  },
};

registerCollider(RECTANGLE_COLLIDER);
registerResolver(STATIC_RESOLVER);

registerCollider(CIRCLE_COLLIDER);
registerResolver(BOUNCY_RESOLVER);
